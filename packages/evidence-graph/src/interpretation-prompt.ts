import type { EventType, EvidenceEvent, ModelInterpretation } from "./schemas/evidence.js";

const _ALLOWED_EVENT_TYPES: EventType[] = [
  "sentence_first_seen",
  "sentence_removed",
  "sentence_reintroduced",
  "citation_added",
  "citation_removed",
  "citation_replaced",
  "template_added",
  "template_removed",
  "revert_detected",
  "section_reorganized",
  "lead_promotion",
  "lead_demotion",
  "page_moved",
  "wikilink_added",
  "wikilink_removed",
  "category_added",
  "category_removed",
  "protection_changed",
  "talk_page_correlated",
  "talk_thread_opened",
  "talk_thread_archived",
  "talk_reply_added",
  "template_parameter_changed",
  "edit_cluster_detected",
  "talk_activity_spike",
];

export const ModelInterpretationSchema = {
  type: "object" as const,
  properties: {
    semanticChange: { type: "string" as const, description: "Description of what changed and why" },
    confidence: {
      type: "number" as const,
      minimum: 0,
      maximum: 1,
      description: "Confidence in this interpretation (0.0–1.0)",
    },
    policyDimension: {
      type: "string" as const,
      enum: [
        "verifiability",
        "npov",
        "blp",
        "due_weight",
        "protection",
        "edit_warring",
        "notability",
        "copyright",
        "civility",
      ],
      description: "Wikipedia policy dimension this event relates to",
    },
    discussionType: {
      type: "string" as const,
      enum: [
        "notability_challenge",
        "sourcing_dispute",
        "neutrality_concern",
        "content_deletion",
        "content_addition",
        "naming_dispute",
        "procedural",
        "other",
      ],
      description: "Type of talk page discussion this event correlates with",
    },
  },
  required: ["semanticChange", "confidence"],
} as const;

const EVENT_DESCRIPTIONS: Partial<Record<EventType, string>> = {
  sentence_first_seen: "a sentence appeared for the first time",
  sentence_removed: "a sentence was deleted entirely",
  sentence_reintroduced: "a previously removed sentence was restored",
  citation_added: "a new reference or citation was added",
  citation_removed: "an existing reference was removed",
  citation_replaced: "one citation was replaced by another",
  template_added: "a maintenance or policy template was added",
  template_removed: "a template was removed",
  revert_detected: "an edit summary indicates a revert",
  section_reorganized: "sections were added, removed, or reordered",
  lead_promotion: "content moved from the body into the lead section",
  lead_demotion: "content moved from the lead into the body",
  page_moved: "the page was renamed",
  wikilink_added: "a new internal link was added",
  wikilink_removed: "an internal link was removed",
  category_added: "a category was added",
  category_removed: "a category was removed",
  protection_changed: "page protection level changed",
  talk_page_correlated: "a talk page discussion exists near this revision",
  talk_thread_opened: "a new talk page thread was created",
  talk_thread_archived: "a talk page thread was archived",
  talk_reply_added: "a reply was posted in an existing talk thread",
  template_parameter_changed: "a template parameter was modified",
  edit_cluster_detected: "multiple edits within a short time window",
  talk_activity_spike: "talk page activity exceeds normal levels",
};

const POLICY_DIMENSION_DESCRIPTIONS: Record<string, string> = {
  verifiability: "claims and sourcing — citations added/removed, citation needed tags",
  npov: "neutral point of view — bias, balancing claims, fair representation",
  blp: "biographies of living persons — potentially defamatory or unsourced claims about living people",
  due_weight: "proportionate coverage — undue emphasis on fringe views",
  protection: "page protection — edit restrictions, dispute mitigation",
  edit_warring: "revert cycles and content disputes",
  notability: "whether the topic meets inclusion criteria",
  copyright: "potential copyright violations",
  civility: "editor conduct and dispute tone",
};

export function buildInterpretationPrompt(events: EvidenceEvent[], pageTitle: string): string {
  const summary = summarizeEvents(events);

  const lines: string[] = [
    `You are analyzing edit history events from the Wikipedia page "${pageTitle}".`,
    "For each event below, provide a structured interpretation: what changed semantically,",
    "your confidence level, which (if any) Wikipedia policy dimension applies, and whether",
    "this event correlates with a talk page discussion type.",
    "",
    "These are mechanically observed events — factual descriptions of what appeared or disappeared",
    "at revision boundaries. Your job is not to repeat the mechanical description but to",
    "interpret what the change means in editorial context.",
    "",
    "Return a JSON array with one object per event, using this schema:",
    JSON.stringify(ModelInterpretationSchema, null, 2),
    "",
    `Total events: ${events.length}`,
    `Page: ${pageTitle}`,
    `Event type breakdown:`,
    ...Object.entries(summary.byType)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => `  ${type}: ${count} — ${EVENT_DESCRIPTIONS[type as EventType] ?? ""}`),
    "",
    "Policy dimensions:",
    ...Object.entries(POLICY_DIMENSION_DESCRIPTIONS).map(([dim, desc]) => `  ${dim}: ${desc}`),
    "",
    "Discussion types:",
    ...[
      "notability_challenge",
      "sourcing_dispute",
      "neutrality_concern",
      "content_deletion",
      "content_addition",
      "naming_dispute",
      "procedural",
      "other",
    ].map((t) => `  ${t}`),
    "",
    "Events:",
    ...events.map((e, i) => {
      const section = e.section ? ` [${e.section}]` : "";
      const facts = e.deterministicFacts.map((f) => `${f.fact}${f.detail ? `: ${f.detail}` : ""}`).join("; ");
      return `  ${i + 1}. ${e.eventType}${section} (rev ${e.fromRevisionId}→${e.toRevisionId})${facts ? ` — ${facts}` : ""}`;
    }),
  ];

  return lines.join("\n");
}

export function parseInterpretationResponse(text: string): ModelInterpretation[] {
  const cleaned = text.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item: unknown) => {
      if (typeof item !== "object" || item === null) return null;
      const obj = item as Record<string, unknown>;
      if (typeof obj.semanticChange !== "string" || typeof obj.confidence !== "number") return null;
      return {
        semanticChange: obj.semanticChange,
        confidence: Math.max(0, Math.min(1, obj.confidence)),
        ...(typeof obj.policyDimension === "string"
          ? { policyDimension: obj.policyDimension as ModelInterpretation["policyDimension"] }
          : {}),
        ...(typeof obj.discussionType === "string"
          ? { discussionType: obj.discussionType as ModelInterpretation["discussionType"] }
          : {}),
      } satisfies ModelInterpretation;
    })
    .filter((item): item is ModelInterpretation => item !== null);
}

function summarizeEvents(events: EvidenceEvent[]): { byType: Record<string, number> } {
  const byType: Record<string, number> = {};
  for (const e of events) {
    byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;
  }
  return { byType };
}
