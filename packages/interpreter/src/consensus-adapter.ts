import type { EvidenceEvent, ModelInterpretation } from "@var-ia/evidence-graph";
import type { ModelAdapter, InterpretedEvent, LineageContext } from "./index.js";

export interface ConsensusConfig {
  adapters: ModelAdapter[];
  minConsensus?: number;
  confidenceThreshold?: number;
  agreementKey?: (interp: ModelInterpretation) => string;
}

export class ConsensusAdapter implements ModelAdapter {
  private adapters: ModelAdapter[];
  private minConsensus: number;
  private confidenceThreshold: number;
  private agreementKey: (interp: ModelInterpretation) => string;

  constructor(config: ConsensusConfig) {
    if (config.adapters.length < 2) {
      throw new Error("ConsensusAdapter requires at least 2 adapters");
    }
    this.adapters = config.adapters;
    this.minConsensus = config.minConsensus ?? 2;
    this.confidenceThreshold = config.confidenceThreshold ?? 0.5;
    this.agreementKey = config.agreementKey ?? ((i) => i.semanticChange);
  }

  async interpret(events: EvidenceEvent[], lineage?: LineageContext): Promise<InterpretedEvent[]> {
    const allResults = await Promise.all(
      this.adapters.map((a) => a.interpret(events, lineage)),
    );

    const consolidated: InterpretedEvent[] = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const interpretations = allResults
        .map((r) => r[i]?.modelInterpretation)
        .filter(
          (m): m is ModelInterpretation =>
            m != null && m.confidence >= this.confidenceThreshold,
        );

      const groups = new Map<string, { count: number; avgConfidence: number; sample: ModelInterpretation }>();

      for (const interp of interpretations) {
        const key = this.agreementKey(interp);
        const existing = groups.get(key);

        if (existing) {
          existing.avgConfidence =
            (existing.avgConfidence * existing.count + interp.confidence) /
            (existing.count + 1);
          existing.count++;
          if (!existing.sample.policyDimension && interp.policyDimension) {
            existing.sample = interp;
          }
        } else {
          groups.set(key, { count: 1, avgConfidence: interp.confidence, sample: interp });
        }
      }

      const consensus = [...groups.values()]
        .filter((g) => g.count >= this.minConsensus)
        .sort((a, b) => b.count - a.count)[0];

      if (consensus) {
        consolidated.push({
          ...event,
          modelInterpretation: {
            semanticChange: consensus.sample.semanticChange,
            confidence: consensus.avgConfidence,
            policyDimension: consensus.sample.policyDimension,
          },
        });
      } else {
        consolidated.push({
          ...event,
          modelInterpretation: {
            semanticChange: "no_consensus",
            confidence: 0,
          },
        });
      }
    }

    return consolidated;
  }
}
