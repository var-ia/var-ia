import type { EvidenceEvent, ModelInterpretation, PolicyDimension } from "@var-ia/evidence-graph";

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
  systemPrompt?: string;
}

export type { ConsensusConfig } from "./consensus-adapter.js";
export { ConsensusAdapter } from "./consensus-adapter.js";
export type { ModelRoute, RouterConfig } from "./model-router.js";
export { ModelRouter } from "./model-router.js";
export type { CascadingRouterConfig } from "./cascading-router.js";
export { CascadingRouter } from "./cascading-router.js";
export type { CalibrationBin, CalibrationData } from "./calibrated-adapter.js";
export { CalibratedAdapter } from "./calibrated-adapter.js";

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

function createOpenAIAdapter(config: ModelConfig): ModelAdapter {
  const endpoint = config.endpoint ?? "https://api.openai.com/v1";
  const model = config.model ?? "gpt-4o";
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
  const temperature = config.temperature ?? 0.1;
  const systemPrompt = config.systemPrompt ?? defaultSystemPrompt;
  if (!apiKey) throw new Error("OpenAI adapter requires apiKey or OPENAI_API_KEY env var");

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
          temperature,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${err.slice(0, 300)}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenAI returned empty response");

      return parseInterpretations(content, events);
    },
  };
}

function createAnthropicAdapter(config: ModelConfig): ModelAdapter {
  const endpoint = config.endpoint ?? "https://api.anthropic.com/v1";
  const model = config.model ?? "claude-sonnet-4-20250514";
  const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const temperature = config.temperature ?? 0.1;
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
          max_tokens: 4096,
          temperature,
          system: systemPrompt,
          messages: [{ role: "user", content: buildUserPrompt(events, lineage) }],
        }),
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

function createDeepSeekAdapter(config: ModelConfig): ModelAdapter {
  const endpoint = config.endpoint ?? "https://api.deepseek.com/v1";
  const model = config.model ?? "deepseek-chat";
  const apiKey = config.apiKey ?? process.env.DEEPSEEK_API_KEY;
  const temperature = config.temperature ?? 0.1;
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
          temperature,
        }),
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

function createLocalAdapter(config: ModelConfig): ModelAdapter {
  const endpoint = config.endpoint ?? "http://localhost:11434";
  const model = config.model ?? "llama3";
  const temperature = config.temperature ?? 0.1;
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
          options: { temperature },
        }),
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

function createByokAdapter(config: ModelConfig): ModelAdapter {
  const endpoint = config.endpoint;
  const model = config.model;
  const apiKey = config.apiKey ?? process.env.BYOK_API_KEY;
  const temperature = config.temperature ?? 0.1;
  const systemPrompt = config.systemPrompt ?? defaultSystemPrompt;
  if (!endpoint) throw new Error("BYOK adapter requires endpoint");
  if (!model) throw new Error("BYOK adapter requires model");
  if (!apiKey) throw new Error("BYOK adapter requires apiKey or BYOK_API_KEY env var");

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
          temperature,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`BYOK API error ${response.status}: ${err.slice(0, 300)}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("BYOK endpoint returned empty response");

      return parseInterpretations(content, events);
    },
  };
}

const defaultSystemPrompt = `You are a wiki edit classifier. Given a list of evidence events describing what changed between revisions, classify each event's semantic meaning. For each event, respond with:
- semanticChange: a concise description of what the change means semantically (e.g., "factual claim removed", "attribution strengthened", "sentence reworded without changing meaning")
- confidence: a score from 0.0 to 1.0 indicating how certain you are
- policyDimension (optional): if the change touches a Wikipedia policy, use one of: verifiability, npov, blp, due_weight, protection, edit_warring, notability, copyright, civility
- discussionType (optional, only for talk_page_correlated events): classify the type of talk page discussion using one of: notability_challenge, sourcing_dispute, neutrality_concern, content_deletion, content_addition, naming_dispute, procedural, other

Return ONLY a JSON array of objects with fields: eventIndex (matching the input array index), semanticChange, confidence, policyDimension, discussionType.`;

function buildUserPrompt(events: EvidenceEvent[], lineage?: LineageContext): string {
  let text = `Evidence events to classify:\n${JSON.stringify(
    events.map((e, i) => ({
      index: i,
      eventType: e.eventType,
      section: e.section,
      before: e.before.slice(0, 500),
      after: e.after.slice(0, 500),
      deterministicFacts: e.deterministicFacts,
    })),
    null,
    2,
  )}`;

  if (lineage) {
    if (lineage.summaryText) {
      text += `\n\nLineage context:\n${lineage.summaryText}`;
    } else {
      const summary = buildLineageSummary(lineage);
      if (summary) {
        text += `\n\nLineage context:\n${summary}`;
      }
    }
  }

  return text;
}

function buildLineageSummary(lineage: LineageContext): string {
  const parts: string[] = [];

  if (lineage.sectionLineages && lineage.sectionLineages.length > 0) {
    parts.push("Section history:");
    for (const s of lineage.sectionLineages) {
      const status = s.isActive ? "active" : "removed";
      parts.push(`  - "${s.sectionName}" (${status}, ${s.events.length} changes)`);
    }
  }

  if (lineage.claimLineages && lineage.claimLineages.length > 0) {
    parts.push("Claim history:");
    for (const c of lineage.claimLineages) {
      parts.push(`  - ${c.variants} variant(s), first seen in rev ${c.firstSeenRevisionId}`);
    }
  }

  return parts.join("\n");
}

function parseInterpretations(raw: string, events: EvidenceEvent[]): InterpretedEvent[] {
  let interpretations: Array<{
    eventIndex: number;
    semanticChange: string;
    confidence: number;
    policyDimension?: string;
    discussionType?: string;
  }>;

  try {
    interpretations = JSON.parse(raw);
    if (!Array.isArray(interpretations)) {
      const cleaned = raw.replace(/^```json\s*|```$/g, "").trim();
      interpretations = JSON.parse(cleaned);
    }
  } catch {
    throw new Error(`Failed to parse model response: ${raw.slice(0, 200)}`);
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
        policyDimension: interp?.policyDimension as PolicyDimension | undefined,
        discussionType: interp?.discussionType as ModelInterpretation["discussionType"],
      },
    });
  }

  return interpreted;
}
