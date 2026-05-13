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

function createHostedAdapter(_config: ModelConfig): ModelAdapter {
  // TODO: Implement hosted LLM adapter (OpenAI, Anthropic)
  // Must receive only evidence objects, never raw wikitext
  // Must return bounded interpretations with confidence scores
  throw new Error("Hosted adapter not yet implemented");
}

function createLocalAdapter(config: ModelConfig): ModelAdapter {
  const endpoint = config.endpoint ?? "http://localhost:11434";
  const model = config.model ?? "llama3";

  return {
    async interpret(events: EvidenceEvent[]): Promise<InterpretedEvent[]> {
      const systemPrompt = `You are a Wikipedia edit classifier. Given a list of evidence events describing what changed between revisions, classify each event's semantic meaning. For each event, respond with:
- semanticChange: a concise description of what the change means semantically (e.g., "factual claim removed", "attribution strengthened", "sentence reworded without changing meaning")
- confidence: a score from 0.0 to 1.0 indicating how certain you are
- policyDimension (optional): if the change touches a Wikipedia policy, name it (e.g., "verifiability", "npov", "blp", "due_weight")

Return ONLY a JSON array of objects with fields: eventIndex (matching the input array index), semanticChange, confidence, policyDimension.`;

      const userPrompt = `Evidence events to classify:\n${JSON.stringify(events.map((e, i) => ({ index: i, eventType: e.eventType, section: e.section, before: e.before.slice(0, 500), after: e.after.slice(0, 500), deterministicFacts: e.deterministicFacts })), null, 2)}`;

      const response = await fetch(`${endpoint}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: false,
          format: "json",
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { message?: { content?: string } };
      const content = data.message?.content;
      if (!content) {
        throw new Error("Ollama returned empty response");
      }

      let interpretations: Array<{ eventIndex: number; semanticChange: string; confidence: number; policyDimension?: string }>;
      try {
        interpretations = JSON.parse(content);
        if (!Array.isArray(interpretations)) {
          interpretations = JSON.parse(content.replace(/^```json\s*|```$/g, ""));
        }
      } catch {
        throw new Error(`Failed to parse Ollama response: ${content.slice(0, 200)}`);
      }

      const interpreted: InterpretedEvent[] = [];
      const interpretationMap = new Map(interpretations.map((i) => [i.eventIndex, i]));

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const interp = interpretationMap.get(i);
        interpreted.push({
          ...event,
          modelInterpretation: {
            semanticChange: interp?.semanticChange ?? "unknown",
            confidence: interp?.confidence ?? 0.0,
            policyDimension: interp?.policyDimension,
          },
        });
      }

      return interpreted;
    },
  };
}

function createByokAdapter(_config: ModelConfig): ModelAdapter {
  // TODO: Implement BYOK adapter (customer-specified endpoint)
  throw new Error("BYOK adapter not yet implemented");
}
