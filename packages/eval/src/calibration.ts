import type { CalibrationData, InterpretedEvent } from "@var-ia/interpreter";

export interface ExpectedInterpretation {
  semanticChange: string;
}

export function computeCalibration(
  interpretations: InterpretedEvent[],
  expected: ExpectedInterpretation[],
  modelId = "unknown",
): CalibrationData {
  const BIN_COUNT = 10;
  const bins = Array.from({ length: BIN_COUNT }, (_, i) => ({
    lowerBound: i / BIN_COUNT,
    upperBound: i === BIN_COUNT - 1 ? 1.0 : (i + 1) / BIN_COUNT,
    count: 0,
    correctCount: 0,
    empiricalAccuracy: 0,
  }));

  const sampleCount = Math.min(interpretations.length, expected.length);

  for (let i = 0; i < sampleCount; i++) {
    const interp = interpretations[i].modelInterpretation;
    const expectedInterp = expected[i];

    const binIndex = Math.min(Math.floor(interp.confidence * BIN_COUNT), BIN_COUNT - 1);
    const bin = bins[binIndex];
    bin.count++;

    if (expectedInterp.semanticChange === "any" || interp.semanticChange === expectedInterp.semanticChange) {
      bin.correctCount++;
    }
  }

  for (const bin of bins) {
    bin.empiricalAccuracy = bin.count > 0 ? bin.correctCount / bin.count : 0;
  }

  const totalSamples = sampleCount;
  const correctTotal = bins.reduce((s, b) => s + b.correctCount, 0);
  const overallAccuracy = totalSamples > 0 ? correctTotal / totalSamples : 0;

  const ece = bins.reduce((s, b) => {
    if (b.count === 0) return s;
    const mid = (b.lowerBound + b.upperBound) / 2;
    return s + (b.count / totalSamples) * Math.abs(mid - b.empiricalAccuracy);
  }, 0);

  return {
    modelId,
    bins,
    totalSamples,
    overallAccuracy,
    ece,
  };
}
