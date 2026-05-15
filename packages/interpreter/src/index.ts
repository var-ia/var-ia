import type { EvidenceEvent, ModelInterpretation } from "@var-ia/evidence-graph";
import { createAnthropicAdapter } from "./adapters/anthropic.js";
import { createByokAdapter } from "./adapters/byok.js";
import { createDeepSeekAdapter } from "./adapters/deepseek.js";
import { createLocalAdapter } from "./adapters/local.js";
import { createOpenAIAdapter } from "./adapters/openai.js";

// Lineage types used by the interpreter but defined here to avoid
// coupling the interpreter to the analyzers package. The shape is
// deliberately minimal — just enough for prompt enrichment.
export interface SectionLineageSummary {
  sectionName: string;
  events: string[];
  isActive: boolean;
}

export interface ClaimLineageSummary {
  firstSeenRevisionId: number;
  variants: number;
}

export interface LineageContext {
  sectionLineages?: SectionLineageSummary[];
  claimLineages?: ClaimLineageSummary[];
  summaryText?: string;
}

export interface ModelAdapter {
  interpret(events: EvidenceEvent[], lineage?: LineageContext): Promise<InterpretedEvent[]>;
}

export interface InterpretedEvent extends EvidenceEvent {
  modelInterpretation: ModelInterpretation;
}

export interface ModelConfig {
  provider: "openai" | "anthropic" | "deepseek" | "local" | "byok";
  apiKey?: string;
  model?: string;
  endpoint?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  systemPrompt?: string;
}

export type { CalibrationBin, CalibrationData } from "./calibrated-adapter.js";
export { ConsensusAdapter } from "./consensus-adapter.js";
export { ModelRouter } from "./model-router.js";

export function createAdapter(config: ModelConfig): ModelAdapter {
  switch (config.provider) {
    case "openai":
      return createOpenAIAdapter(config);
    case "anthropic":
      return createAnthropicAdapter(config);
    case "deepseek":
      return createDeepSeekAdapter(config);
    case "local":
      return createLocalAdapter(config);
    case "byok":
      return createByokAdapter(config);
    default:
      throw new Error(`Unknown model provider: ${config.provider}`);
  }
}
