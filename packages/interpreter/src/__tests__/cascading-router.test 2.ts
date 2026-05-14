import type { EvidenceEvent, EvidenceLayer, ModelInterpretation } from "@var-ia/evidence-graph";
import { describe, expect, it } from "vitest";
import type { ModelAdapter } from "../index.js";
import { CascadingRouter } from "../cascading-router.js";
import type { LineageContext } from "../index.js";

function makeEvent(eventType = "revert_detected"): EvidenceEvent {
  const layer: EvidenceLayer = "observed";
  const ev: EvidenceEvent = {
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
  return ev;
}

describe("CascadingRouter", () => {
  it("throws without primary adapter", () => {
    expect(
      () =>
        new CascadingRouter({
          primary: undefined as unknown as ModelAdapter,
          fallback: { interpret: async () => [] },
        }),
    ).toThrow("CascadingRouter requires primary adapter");
  });

  it("throws without fallback adapter", () => {
    expect(
      () =>
        new CascadingRouter({
          primary: { interpret: async () => [] },
          fallback: undefined as unknown as ModelAdapter,
        }),
    ).toThrow("CascadingRouter requires fallback adapter");
  });

  it("returns primary results when all above threshold", async () => {
    const primary: ModelAdapter = {
      interpret: async (events) =>
        events.map((e) => ({
          ...e,
          modelInterpretation: { semanticChange: "primary", confidence: 0.9 } as ModelInterpretation,
        })),
    };
    const fallback: ModelAdapter = {
      interpret: async () => {
        throw new Error("should not be called");
      },
    };

    const router = new CascadingRouter({ primary, fallback, confidenceThreshold: 0.6 });
    const results = await router.interpret([makeEvent()]);
    expect(results).toHaveLength(1);
    expect(results[0].modelInterpretation.semanticChange).toBe("primary");
    expect(results[0].modelInterpretation.confidence).toBe(0.9);
  });

  it("escalates low-confidence events to fallback", async () => {
    const primary: ModelAdapter = {
      interpret: async (events) =>
        events.map((e, i) => ({
          ...e,
          modelInterpretation: { semanticChange: `primary-${i}`, confidence: 0.3 } as ModelInterpretation,
        })),
    };
    const fallback: ModelAdapter = {
      interpret: async (events) =>
        events.map((e) => ({
          ...e,
          modelInterpretation: { semanticChange: "fallback", confidence: 0.9 } as ModelInterpretation,
        })),
    };

    const router = new CascadingRouter({ primary, fallback, confidenceThreshold: 0.6 });
    const results = await router.interpret([makeEvent()]);
    expect(results).toHaveLength(1);
    expect(results[0].modelInterpretation.semanticChange).toBe("fallback");
    expect(results[0].modelInterpretation.confidence).toBe(0.9);
  });

  it("only escalates events below threshold, keeps high-confidence ones", async () => {
    const primaryCalls: number[] = [];
    const fallbackCalls: number[] = [];

    const primary: ModelAdapter = {
      interpret: async (events) => {
        primaryCalls.push(events.length);
        return events.map((e, i) => ({
          ...e,
          modelInterpretation: {
            semanticChange: `primary-${i}`,
            confidence: i === 1 ? 0.3 : 0.9,
          } as ModelInterpretation,
        }));
      },
    };
    const fallback: ModelAdapter = {
      interpret: async (events) => {
        fallbackCalls.push(events.length);
        return events.map((e, i) => ({
          ...e,
          modelInterpretation: {
            semanticChange: `fallback-${i}`,
            confidence: 0.95,
          } as ModelInterpretation,
        }));
      },
    };

    const router = new CascadingRouter({ primary, fallback, confidenceThreshold: 0.6 });
    const events = [makeEvent("revert_detected"), makeEvent("citation_added"), makeEvent("claim_removed")];
    const results = await router.interpret(events);

    expect(results).toHaveLength(3);
    expect(results[0].modelInterpretation.semanticChange).toBe("primary-0");
    expect(results[1].modelInterpretation.semanticChange).toBe("fallback-0");
    expect(results[2].modelInterpretation.semanticChange).toBe("primary-2");
    expect(primaryCalls).toEqual([3]);
    expect(fallbackCalls).toEqual([1]);
  });

  it("respects maxEscalationFraction cap", async () => {
    const primary: ModelAdapter = {
      interpret: async (events) =>
        events.map((e, i) => ({
          ...e,
          modelInterpretation: { semanticChange: `primary-${i}`, confidence: 0.3 } as ModelInterpretation,
        })),
    };
    const fallback: ModelAdapter = {
      interpret: async (events) =>
        events.map((e, i) => ({
          ...e,
          modelInterpretation: { semanticChange: `fallback-${i}`, confidence: 0.9 } as ModelInterpretation,
        })),
    };

    const router = new CascadingRouter({
      primary,
      fallback,
      confidenceThreshold: 0.6,
      maxEscalationFraction: 0.5,
    });
    const events = [makeEvent(), makeEvent(), makeEvent(), makeEvent()];
    const results = await router.interpret(events);

    expect(results).toHaveLength(4);
    const fallbackCount = results.filter((r) => r.modelInterpretation.semanticChange.startsWith("fallback")).length;
    expect(fallbackCount).toBe(2); // 0.5 * 4 = 2 max
  });

  it("passes lineage context to both adapters", async () => {
    let primaryLineage: LineageContext | undefined;
    let fallbackLineage: LineageContext | undefined;

    const primary: ModelAdapter = {
      interpret: async (events, lineage) => {
        primaryLineage = lineage;
        return events.map((e) => ({
          ...e,
          modelInterpretation: { semanticChange: "primary", confidence: 0.3 } as ModelInterpretation,
        }));
      },
    };
    const fallback: ModelAdapter = {
      interpret: async (events, lineage) => {
        fallbackLineage = lineage;
        return events.map((e) => ({
          ...e,
          modelInterpretation: { semanticChange: "fallback", confidence: 0.9 } as ModelInterpretation,
        }));
      },
    };

    const lineage: LineageContext = {
      summaryText: "test lineage",
    };
    const router = new CascadingRouter({ primary, fallback, confidenceThreshold: 0.6 });
    await router.interpret([makeEvent()], lineage);

    expect(primaryLineage).toBe(lineage);
    expect(fallbackLineage).toBe(lineage);
  });

  it("handles empty events array", async () => {
    const primary: ModelAdapter = { interpret: async () => [] };
    const fallback: ModelAdapter = { interpret: async () => [] };
    const router = new CascadingRouter({ primary, fallback });
    const results = await router.interpret([]);
    expect(results).toEqual([]);
  });

  it("uses default threshold of 0.6", async () => {
    const primary: ModelAdapter = {
      interpret: async (events) =>
        events.map((e) => ({
          ...e,
          modelInterpretation: { semanticChange: "primary", confidence: 0.6 } as ModelInterpretation,
        })),
    };
    const fallback: ModelAdapter = {
      interpret: async () => {
        throw new Error("should not be called at 0.6");
      },
    };

    const router = new CascadingRouter({ primary, fallback });
    const results = await router.interpret([makeEvent()]);
    expect(results[0].modelInterpretation.confidence).toBe(0.6);
  });

  it("threshold is exclusive (below threshold triggers escalation)", async () => {
    const primary: ModelAdapter = {
      interpret: async (events) =>
        events.map((e) => ({
          ...e,
          modelInterpretation: { semanticChange: "primary", confidence: 0.59 } as ModelInterpretation,
        })),
    };
    let fallbackCalled = false;
    const fallback: ModelAdapter = {
      interpret: async (events) => {
        fallbackCalled = true;
        return events.map((e) => ({
          ...e,
          modelInterpretation: { semanticChange: "fallback", confidence: 0.95 } as ModelInterpretation,
        }));
      },
    };

    const router = new CascadingRouter({ primary, fallback, confidenceThreshold: 0.6 });
    await router.interpret([makeEvent()]);
    expect(fallbackCalled).toBe(true);
  });
});
