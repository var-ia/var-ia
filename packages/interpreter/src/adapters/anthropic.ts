import type { EvidenceEvent } from "@var-ia/evidence-graph";
import type { InterpretedEvent, LineageContext, ModelAdapter, ModelConfig } from "../index.js";
import { buildUserPrompt, defaultSystemPrompt, parseInterpretations } from "./shared.js";

export function createAnthropicAdapter(config: ModelConfig): ModelAdapter {
  const endpoint = config.endpoint ?? "https://api.anthropic.com/v1";
  const model = config.model ?? "claude-sonnet-4-20250514";
  const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const temperature = config.temperature ?? 0.1;
  const maxTokens = config.maxTokens ?? 4096;
  const timeoutMs = config.timeoutMs ?? 120000;
  const systemPrompt = config.systemPrompt ?? defaultSystemPrompt;
  if (!apiKey) throw new Error("Anthropic adapter requires apiKey or ANTHROPIC_API_KEY env var");

  return {
    async interpret(events: EvidenceEvent[], lineage?: LineageContext): Promise<InterpretedEvent[]> {
      const response = await fetch(`${endpoint}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages: [{ role: "user", content: buildUserPrompt(events, lineage) }],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${err.slice(0, 300)}`);
      }

      const data = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const content = data.content?.find((c) => c.type === "text")?.text;
      if (!content) throw new Error("Anthropic returned empty response");

      return parseInterpretations(content, events);
    },
  };
}
