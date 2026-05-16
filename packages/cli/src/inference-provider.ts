import type { InferenceBoundary, InferenceResult } from "@refract-org/evidence-graph";
import { buildInferencePrompt, parseInferenceResponse } from "@refract-org/evidence-graph";

export interface InferenceProvider {
  infer(boundary: InferenceBoundary, input: Record<string, unknown>): Promise<InferenceResult>;
}

/**
 * OpenAI-compatible REST provider — works with any API that exposes a
 * /chat/completions endpoint (OpenAI, DeepSeek, Ollama, Anthropic via
 * API proxy, local OpenAI-compatible servers, etc.).
 *
 * Configure via --endpoint and --model flags, or environment variables:
 *   REFRACT_INFERENCE_ENDPOINT   (default: https://api.openai.com/v1/chat/completions)
 *   REFRACT_INFERENCE_API_KEY
 *   REFRACT_INFERENCE_MODEL      (default: gpt-4o-mini)
 *
 * Examples:
 *   DeepSeek:     --endpoint https://api.deepseek.com/v1/chat/completions --model deepseek-chat
 *   Ollama:       --endpoint http://localhost:11434/v1/chat/completions --model llama3
 *   Anyscale:     --endpoint https://api.endpoints.anyscale.com/v1/chat/completions
 *   Together:     --endpoint https://api.together.xyz/v1/chat/completions
 */
export class OpenAICompatibleProvider implements InferenceProvider {
  private endpoint: string;
  private apiKey: string;
  private model: string;

  constructor(opts: { endpoint?: string; apiKey?: string; model?: string }) {
    this.endpoint = opts.endpoint ?? "https://api.openai.com/v1/chat/completions";
    this.apiKey = opts.apiKey ?? "";
    this.model = opts.model ?? "gpt-4o-mini";
  }

  async infer(boundary: InferenceBoundary, input: Record<string, unknown>): Promise<InferenceResult> {
    const prompt = buildInferencePrompt(boundary, input);

    if (this.apiKey) {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 64,
          temperature: 0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Inference provider error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const text = data.choices?.[0]?.message?.content ?? "";
      return parseInferenceResponse(boundary, text, input);
    }

    return { boundary, output: {}, source: "default" };
  }
}
