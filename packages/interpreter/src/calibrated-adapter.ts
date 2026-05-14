import type { EvidenceEvent } from "@var-ia/evidence-graph";
import type { InterpretedEvent, LineageContext, ModelAdapter } from "./index.js";

export interface CalibrationBin {
  lowerBound: number;
  upperBound: number;
  count: number;
  correctCount: number;
  empiricalAccuracy: number;
}

export interface CalibrationData {
  modelId: string;
  bins: CalibrationBin[];
  totalSamples: number;
  overallAccuracy: number;
  ece: number;
}

export class CalibratedAdapter implements ModelAdapter {
  private inner: ModelAdapter;
  private calibration: CalibrationData;

  constructor(inner: ModelAdapter, calibration: CalibrationData) {
    this.inner = inner;
    this.calibration = calibration;
  }

  async interpret(events: EvidenceEvent[], lineage?: LineageContext): Promise<InterpretedEvent[]> {
    const results = await this.inner.interpret(events, lineage);

    return results.map((event) => ({
      ...event,
      modelInterpretation: {
        ...event.modelInterpretation,
        confidence: this.calibrate(event.modelInterpretation.confidence),
      },
    }));
  }

  private calibrate(rawConfidence: number): number {
    if (this.calibration.bins.length === 0) return rawConfidence;

    const bin = this.calibration.bins.find(
      (b) => rawConfidence >= b.lowerBound && rawConfidence < b.upperBound,
    );
    if (!bin || bin.count === 0) return rawConfidence;

    return bin.empiricalAccuracy;
  }
}
