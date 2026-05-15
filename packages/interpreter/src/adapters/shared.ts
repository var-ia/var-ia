import type { EvidenceEvent, ModelInterpretation, PolicyDimension } from "@var-ia/evidence-graph";
import type { InterpretedEvent, LineageContext } from "../index.js";

export const defaultSystemPrompt = `You are a wiki edit classifier. Given a list of evidence events describing what changed between revisions, classify each event's semantic meaning. For each event, respond with:
- semanticChange: a concise description of what the change means semantically (e.g., "factual claim removed", "attribution strengthened", "sentence reworded without changing meaning")
- confidence: a score from 0.0 to 1.0 indicating how certain you are
- policyDimension (optional): if the change touches a Wikipedia policy, use one of: verifiability, npov, blp, due_weight, protection, edit_warring, notability, copyright, civility
- discussionType (optional, only for talk_page_correlated events): classify the type of talk page discussion using one of: notability_challenge, sourcing_dispute, neutrality_concern, content_deletion, content_addition, naming_dispute, procedural, other

Return ONLY a JSON array of objects with fields: eventIndex (matching the input array index), semanticChange, confidence, policyDimension, discussionType.`;

export function buildUserPrompt(events: EvidenceEvent[], lineage?: LineageContext): string {
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
    0,
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

export function buildLineageSummary(lineage: LineageContext): string {
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

export function parseInterpretations(raw: string, events: EvidenceEvent[]): InterpretedEvent[] {
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
