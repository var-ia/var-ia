import type { EvidenceEvent } from "@var-ia/evidence-graph";
import type { InterpretedEvent, LineageContext, ModelAdapter } from "./index.js";

export interface CascadingRouterConfig {
  primary: ModelAdapter;
  fallback: ModelAdapter;
  confidenceThreshold?: number;
  maxEscalationFraction?: number;
}

export class CascadingRouter implements ModelAdapter {
  private primary: ModelAdapter;
  private fallback: ModelAdapter;
  private threshold: number;
  private maxEscalation: number;

  constructor(config: CascadingRouterConfig) {
    if (!config.primary) throw new Error("CascadingRouter requires primary adapter");
    if (!config.fallback) throw new Error("CascadingRouter requires fallback adapter");
    this.primary = config.primary;
    this.fallback = config.fallback;
    this.threshold = config.confidenceThreshold ?? 0.6;
    this.maxEscalation = config.maxEscalationFraction ?? 1.0;
  }

  async interpret(events: EvidenceEvent[], lineage?: LineageContext): Promise<InterpretedEvent[]> {
    const primaryResults = await this.primary.interpret(events, lineage);

    const lowConfidenceIndices: number[] = [];
    for (let i = 0; i < primaryResults.length; i++) {
      if (primaryResults[i].modelInterpretation.confidence < this.threshold) {
        lowConfidenceIndices.push(i);
      }
    }

    if (lowConfidenceIndices.length === 0) {
      return primaryResults;
    }

    const cap = Math.max(1, Math.floor(this.maxEscalation * events.length));
    const toEscalate = lowConfidenceIndices.slice(0, cap);
    const fallbackEvents = toEscalate.map((i) => events[i]);
    const fallbackResults = await this.fallback.interpret(fallbackEvents, lineage);

    const merged = [...primaryResults];
    for (let j = 0; j < toEscalate.length; j++) {
      merged[toEscalate[j]] = fallbackResults[j];
    }

    return merged;
  }
}
