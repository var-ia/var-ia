import type { EvidenceEvent } from "@var-ia/evidence-graph";
import type { InterpretedEvent, LineageContext, ModelAdapter, ModelConfig } from "../index.js";
import { buildUserPrompt, defaultSystemPrompt, parseInterpretations } from "./shared.js";

export function createLocalAdapter(config: ModelConfig): ModelAdapter {
  const endpoint = config.endpoint ?? "http://localhost:11434";
  const model = config.model ?? "llama3";
  const temperature = config.temperature ?? 0.1;
  const maxTokens = config.maxTokens ?? 4096;
  const timeoutMs = config.timeoutMs ?? 120000;
  const systemPrompt = config.systemPrompt ?? defaultSystemPrompt;

  return {
    async interpret(events: EvidenceEvent[], lineage?: LineageContext): Promise<InterpretedEvent[]> {
      const response = await fetch(`${endpoint}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: buildUserPrompt(events, lineage) },
          ],
          stream: false,
          format: "json",
          options: { temperature, num_predict: maxTokens },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { message?: { content?: string } };
      const content = data.message?.content;
      if (!content) throw new Error("Ollama returned empty response");

      return parseInterpretations(content, events);
    },
  };
}
