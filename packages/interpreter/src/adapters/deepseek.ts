import type { EvidenceEvent } from "@var-ia/evidence-graph";
import type { InterpretedEvent, LineageContext, ModelAdapter, ModelConfig } from "../index.js";
import { buildUserPrompt, defaultSystemPrompt, parseInterpretations } from "./shared.js";

export function createDeepSeekAdapter(config: ModelConfig): ModelAdapter {
  const endpoint = config.endpoint ?? "https://api.deepseek.com/v1";
  const model = config.model ?? "deepseek-chat";
  const apiKey = config.apiKey ?? process.env.DEEPSEEK_API_KEY;
  const temperature = config.temperature ?? 0.1;
  const maxTokens = config.maxTokens ?? 4096;
  const timeoutMs = config.timeoutMs ?? 120000;
  const systemPrompt = config.systemPrompt ?? defaultSystemPrompt;
  if (!apiKey) throw new Error("DeepSeek adapter requires apiKey or DEEPSEEK_API_KEY env var");

  return {
    async interpret(events: EvidenceEvent[], lineage?: LineageContext): Promise<InterpretedEvent[]> {
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: buildUserPrompt(events, lineage) },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`DeepSeek API error ${response.status}: ${err.slice(0, 300)}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("DeepSeek returned empty response");

      return parseInterpretations(content, events);
    },
  };
}
