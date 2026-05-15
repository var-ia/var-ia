import type { EvidenceEvent, EvidenceLayer, ModelInterpretation } from "@var-ia/evidence-graph";
import type { InterpretedEvent } from "@var-ia/interpreter";
import { describe, expect, it } from "vitest";
import type { ExpectedInterpretation } from "../calibration.js";
import { computeCalibration } from "../calibration.js";

function makeInterpretedEvent(eventType: string, semanticChange: string, confidence: number): InterpretedEvent {
  const layer: EvidenceLayer = "observed";
  return {
    eventType: eventType as EvidenceEvent["eventType"],
    fromRevisionId: 1,
    toRevisionId: 2,
    section: "body",
    before: "",
    after: "change",
    deterministicFacts: [{ fact: "test" }],
    modelInterpretation: { semanticChange, confidence } as ModelInterpretation,
    layer,
    timestamp: "2026-01-01T00:00:00Z",
  };
}

describe("computeCalibration", () => {
  it("returns perfect calibration when model is always correct and confident", () => {
    const interpretations = [makeInterpretedEvent("revert_detected", "revert", 0.9)];
    const expected: ExpectedInterpretation[] = [{ semanticChange: "revert" }];

    const result = computeCalibration(interpretations, expected);

    expect(result.totalSamples).toBe(1);
    expect(result.overallAccuracy).toBe(1.0);
    // Confidence 0.9 maps to bin 9 [0.9, 1.0)
    const bin = result.bins[9];
    expect(bin.count).toBe(1);
    expect(bin.empiricalAccuracy).toBe(1.0);
  });

  it("reports zero accuracy when model is always wrong", () => {
    const interpretations = [
      makeInterpretedEvent("revert_detected", "revert", 0.9),
      makeInterpretedEvent("citation_added", "add", 0.8),
    ];
    const expected: ExpectedInterpretation[] = [
      { semanticChange: "something_else" },
      { semanticChange: "something_else" },
    ];

    const result = computeCalibration(interpretations, expected);

    expect(result.overallAccuracy).toBe(0.0);
  });

  it("computes ECE correctly for perfectly calibrated model", () => {
    const interpretations: InterpretedEvent[] = [];
    const expected: ExpectedInterpretation[] = [];

    // For each bin, create N=100 samples at the bin midpoint.
    // Set correctCount such that accuracy ≈ midpoint for ECE ≈ 0.
    // ECE = sum over bins of (bin_fraction * abs(midpoint - accuracy))
    // With 10 bins each having 100 samples, bin_fraction = 0.1.
    // accuracy = correctCount / 100.
    // Set correctCount = round(midpoint * 100) so accuracy ≈ midpoint.
    const counts = [5, 15, 25, 35, 45, 55, 65, 75, 85, 95];
    for (let bin = 0; bin < 10; bin++) {
      const mid = (bin + 0.5) / 10;
      const correct = counts[bin];
      const total = 100;
      for (let j = 0; j < total; j++) {
        const semanticChange = j < correct ? `correct-${bin}` : `wrong-${bin}`;
        interpretations.push(makeInterpretedEvent("revert_detected", semanticChange, mid));
        expected.push({ semanticChange: `correct-${bin}` });
      }
    }

    const result = computeCalibration(interpretations, expected);

    // Each bin has accuracy ≈ midpoint, so ECE should be small
    expect(result.ece).toBeLessThan(0.02);
    expect(result.totalSamples).toBe(1000);
    expect(result.overallAccuracy).toBeGreaterThan(0.4);
  });

  it("handles empty input", () => {
    const result = computeCalibration([], []);
    expect(result.totalSamples).toBe(0);
    expect(result.overallAccuracy).toBe(0);
    expect(result.ece).toBe(0);
  });

  it("truncates to shorter input length", () => {
    const interpretations = [makeInterpretedEvent("revert_detected", "revert", 0.9)];
    const expected: ExpectedInterpretation[] = [{ semanticChange: "revert" }, { semanticChange: "add" }];

    const result = computeCalibration(interpretations, expected);
    expect(result.totalSamples).toBe(1);
  });

  it("accepts 'any' wildcard to always count as correct", () => {
    const interpretations = [
      makeInterpretedEvent("revert_detected", "whatever", 0.7),
      makeInterpretedEvent("citation_added", "anything", 0.6),
    ];
    const expected: ExpectedInterpretation[] = [{ semanticChange: "any" }, { semanticChange: "any" }];

    const result = computeCalibration(interpretations, expected);
    expect(result.overallAccuracy).toBe(1.0);
  });

  it("stores modelId in result", () => {
    const result = computeCalibration([], [], "test-model-v1");
    expect(result.modelId).toBe("test-model-v1");
  });

  it("bins are 0.0-0.1, 0.1-0.2, ..., 0.9-1.0", () => {
    const result = computeCalibration([], [], "");
    expect(result.bins).toHaveLength(10);
    expect(result.bins[0].lowerBound).toBe(0.0);
    expect(result.bins[0].upperBound).toBe(0.1);
    expect(result.bins[9].lowerBound).toBe(0.9);
    expect(result.bins[9].upperBound).toBe(1.0);
  });
});
