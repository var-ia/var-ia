import type { EvidenceEvent, EvidenceLayer, ModelInterpretation } from "@var-ia/evidence-graph";
import { describe, expect, it } from "vitest";
import type { ModelAdapter, ModelConfig } from "../index.js";
import { ConsensusAdapter, createAdapter } from "../index.js";

function makeEvent(eventType = "revert_detected"): EvidenceEvent {
  const layer: EvidenceLayer = "observed";
  return {
    eventType: eventType as EvidenceEvent["eventType"],
    fromRevisionId: 1,
    toRevisionId: 2,
    section: "body",
    before: "",
    after: "change",
    deterministicFacts: [{ fact: "test" }],
    layer,
    timestamp: "2026-01-01T00:00:00Z",
  };
}

describe("createAdapter", () => {
  it("throws for missing required config in openai adapter", () => {
    expect(() => createAdapter({ provider: "openai", apiKey: "" })).toThrow();
  });

  it("throws for missing apiUrl in byok adapter", () => {
    expect(() => createAdapter({ provider: "byok", model: "m", apiKey: "k" })).toThrow();
  });

  it("throws for missing model in byok adapter", () => {
    expect(() => createAdapter({ provider: "byok", endpoint: "http://e", apiKey: "k" })).toThrow();
  });

  it("throws for unknown provider", () => {
    expect(() => createAdapter({ provider: "unknown" as ModelConfig["provider"] })).toThrow();
  });

  it("local adapter does not throw on creation (no api key needed)", () => {
    const adapter = createAdapter({ provider: "local", model: "llama3" });
    expect(adapter).toBeDefined();
    expect(typeof adapter.interpret).toBe("function");
  });

  it("deepseek adapter throws without api key", () => {
    const prev = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    expect(() => createAdapter({ provider: "deepseek" })).toThrow();
    if (prev) process.env.DEEPSEEK_API_KEY = prev;
  });

  it("anthropic adapter throws without api key", () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => createAdapter({ provider: "anthropic" })).toThrow();
    if (prev) process.env.ANTHROPIC_API_KEY = prev;
  });
});

describe("ConsensusAdapter", () => {
  it("requires at least two adapters", () => {
    expect(() => new ConsensusAdapter({ adapters: [] })).toThrow();
    const mock = { interpret: async () => [] } as unknown as ModelAdapter;
    expect(() => new ConsensusAdapter({ adapters: [mock] })).toThrow();
  });

  it("runs interpretation when multiple adapters succeed", async () => {
    const mockAdapter: ModelAdapter = {
      interpret: async (events) =>
        events.map((e) => ({
          ...e,
          modelInterpretation: {
            semanticChange: "mock",
            confidence: 0.9,
          } as ModelInterpretation,
        })),
    };

    const consensus = new ConsensusAdapter({ adapters: [mockAdapter, mockAdapter] });
    const events = [makeEvent()];
    const result = await consensus.interpret(events);

    expect(result).toHaveLength(1);
    expect(result[0].modelInterpretation.semanticChange).toBe("mock");
    expect(result[0].modelInterpretation.confidence).toBe(0.9);
  });

  it("aggregates interpretations from multiple adapters", async () => {
    const adapter1: ModelAdapter = {
      interpret: async (events) =>
        events.map((e) => ({
          ...e,
          modelInterpretation: { semanticChange: "a", confidence: 0.8 } as ModelInterpretation,
        })),
    };
    const adapter2: ModelAdapter = {
      interpret: async (events) =>
        events.map((e) => ({
          ...e,
          modelInterpretation: { semanticChange: "b", confidence: 0.7 } as ModelInterpretation,
        })),
    };

    const adapter3: ModelAdapter = {
      interpret: async (events) =>
        events.map((e) => ({
          ...e,
          modelInterpretation: { semanticChange: "c", confidence: 0.6 } as ModelInterpretation,
        })),
    };

    const consensus = new ConsensusAdapter({
      adapters: [adapter1, adapter2, adapter3],
      minConsensus: 2,
    });
    const events = [makeEvent()];
    const result = await consensus.interpret(events);

    expect(result).toHaveLength(1);
  });
});

describe("parseInterpretations", () => {
  function parseInterpretations(
    raw: string,
    events: EvidenceEvent[],
  ): Array<EvidenceEvent & { modelInterpretation: ModelInterpretation }> {
    const interpretations = JSON.parse(raw);
    return events.map((e, i) => {
      const interp = interpretations.find((x: { eventIndex: number }) => x.eventIndex === i);
      return {
        ...e,
        modelInterpretation: {
          semanticChange: interp?.semanticChange ?? "unknown",
          confidence: interp?.confidence ?? 0.0,
          policyDimension: interp?.policyDimension,
          discussionType: interp?.discussionType,
        },
      };
    });
  }

  it("parses valid JSON response", () => {
    const events = [makeEvent()];
    const raw = JSON.stringify([
      { eventIndex: 0, semanticChange: "revert detected", confidence: 0.95, policyDimension: "edit_warring" },
    ]);

    const result = parseInterpretations(raw, events);
    expect(result[0].modelInterpretation.semanticChange).toBe("revert detected");
    expect(result[0].modelInterpretation.confidence).toBe(0.95);
    expect(result[0].modelInterpretation.policyDimension).toBe("edit_warring");
  });

  it("handles discussionType field", () => {
    const events = [makeEvent("talk_page_correlated")];
    const raw = JSON.stringify([
      { eventIndex: 0, semanticChange: "sourcing discussion", confidence: 0.8, discussionType: "sourcing_dispute" },
    ]);

    const result = parseInterpretations(raw, events);
    expect(result[0].modelInterpretation.discussionType).toBe("sourcing_dispute");
  });

  it("defaults unknown fields", () => {
    const events = [makeEvent()];
    const raw = JSON.stringify([{ eventIndex: 0 }]);

    const result = parseInterpretations(raw, events);
    expect(result[0].modelInterpretation.semanticChange).toBe("unknown");
    expect(result[0].modelInterpretation.confidence).toBe(0.0);
  });

  it("handles empty events array", () => {
    const raw = JSON.stringify([]);
    expect(() => parseInterpretations(raw, [])).not.toThrow();
  });

  it("throws for unparseable JSON", () => {
    expect(() => parseInterpretations("not json", [makeEvent()])).toThrow();
  });
});
