import type { EvidenceEvent, ModelInterpretation } from "@wikipedia-provenance/evidence-graph";

export interface ModelAdapter {
  interpret(events: EvidenceEvent[]): Promise<InterpretedEvent[]>;
}

export interface InterpretedEvent extends EvidenceEvent {
  modelInterpretation: ModelInterpretation;
}

export interface ModelConfig {
  provider: "openai" | "anthropic" | "local" | "byok";
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

export function createAdapter(config: ModelConfig): ModelAdapter {
  switch (config.provider) {
    case "openai":
    case "anthropic":
      return createHostedAdapter(config);
    case "local":
      return createLocalAdapter(config);
    case "byok":
      return createByokAdapter(config);
    default:
      throw new Error(`Unknown model provider: ${config.provider}`);
  }
}

function createHostedAdapter(config: ModelConfig): ModelAdapter {
  // TODO: Implement hosted LLM adapter (OpenAI, Anthropic)
  // Must receive only evidence objects, never raw wikitext
  // Must return bounded interpretations with confidence scores
  throw new Error("Hosted adapter not yet implemented");
}

function createLocalAdapter(config: ModelConfig): ModelAdapter {
  // TODO: Implement local model adapter (Ollama, llama.cpp)
  throw new Error("Local adapter not yet implemented");
}

function createByokAdapter(config: ModelConfig): ModelAdapter {
  // TODO: Implement BYOK adapter (customer-specified endpoint)
  throw new Error("BYOK adapter not yet implemented");
}
