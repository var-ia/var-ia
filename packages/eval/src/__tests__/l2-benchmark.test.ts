import type { EvidenceEvent } from "@var-ia/evidence-graph";
import { describe, expect, it, vi } from "vitest";

vi.mock("@var-ia/interpreter", () => ({
  createAdapter: vi.fn(),
}));

import { createAdapter } from "@var-ia/interpreter";
import {
  buildL2Dataset,
  runL2Benchmark,
} from "../l2-benchmark.js";

describe("L2 benchmark", () => {
  it("buildL2Dataset returns 13 test cases", () => {
    const dataset = buildL2Dataset();
    expect(dataset.length).toBe(13);
    for (const tc of dataset) {
      expect(tc.id).toBeTruthy();
      expect(tc.events.length).toBeGreaterThan(0);
      expect(tc.expected.length).toBeGreaterThan(0);
    }
  });

  it("runL2Benchmark scores perfect accuracy for ideal adapter", async () => {
    const dataset = buildL2Dataset();
    let callIndex = 0;
    const mockAdapter = {
      interpret: vi.fn().mockImplementation(async (events) => {
        const tc = dataset[callIndex];
        callIndex++;
        return (events as EvidenceEvent[]).map((e: EvidenceEvent, i: number) => {
          const exp = tc.expected[i];
          return {
            ...e,
            modelInterpretation: {
              semanticChange: exp?.semanticChange ?? "unknown",
              confidence: 0.95,
              policyDimension: exp?.policyDimension ?? null,
              discussionType: exp?.discussionType ?? null,
            },
          };
        });
      }),
    };
    vi.mocked(createAdapter).mockReturnValue(mockAdapter);

    const configs = [{ provider: "openai" as const, model: "gpt-4o", apiKey: "test" }];
    const result = await runL2Benchmark(configs);

    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].overallAccuracy).toBe(100);
    expect(result.testCases).toBe(13);
  });

  it("runL2Benchmark scores zero for adversarial adapter", async () => {
    const mockAdapter = {
      interpret: vi.fn().mockImplementation(async (events) => {
        return (events as EvidenceEvent[]).map((e: EvidenceEvent) => ({
          ...e,
          modelInterpretation: {
            semanticChange: "wrong answer",
            confidence: 0.1,
            policyDimension: "civility",
            discussionType: "other",
          },
        }));
      }),
    };
    vi.mocked(createAdapter).mockReturnValue(mockAdapter);

    const configs = [{ provider: "openai" as const, model: "gpt-4o", apiKey: "test" }];
    const result = await runL2Benchmark(configs);

    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].overallAccuracy).toBeLessThan(100);
  });

  it("handles provider with no API key gracefully", async () => {
    vi.mocked(createAdapter).mockImplementation(() => {
      throw new Error("No API key configured");
    });

    const configs = [{ provider: "openai", apiKey: "" } as { provider: "openai"; apiKey: string }];
    const result = await runL2Benchmark(configs);

    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].totalEvents).toBe(0);
  });
});
