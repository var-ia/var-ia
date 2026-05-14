import { describe, it, expect } from "vitest";
import type { EvidenceEvent, EvidenceLayer, ModelInterpretation } from "@var-ia/evidence-graph";

function makeTalkCorrelatedEvent(revId: number, detail: string): EvidenceEvent {
  const layer: EvidenceLayer = "observed";
  return {
    eventType: "talk_page_correlated",
    fromRevisionId: revId,
    toRevisionId: revId + 100,
    section: "",
    before: "",
    after: "",
    deterministicFacts: [
      { fact: "talk_page_correlated", detail },
    ],
    layer,
    timestamp: "2026-01-01T00:00:00Z",
  };
}

function makeEditEvent(revId: number, eventType: EvidenceEvent["eventType"] = "claim_removed"): EvidenceEvent {
  const layer: EvidenceLayer = "observed";
  return {
    eventType,
    fromRevisionId: revId,
    toRevisionId: revId + 1,
    section: "body",
    before: "old text",
    after: "new text",
    deterministicFacts: [{ fact: "change_detected" }],
    layer,
    timestamp: "2026-01-01T00:00:00Z",
  };
}

function buildUserPrompt(events: EvidenceEvent[]): string {
    const text = `Evidence events to classify:\n${JSON.stringify(
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
  return text;
}

describe("Talk page interpretation input", () => {
  it("passes talk_page_correlated deterministicFacts to model without raw text", () => {
    const events = [
      makeEditEvent(1),
      makeTalkCorrelatedEvent(1, "time_delta_hours=12 talk_comment=discussing source reliability for cancer claim"),
    ];

    const prompt = buildUserPrompt(events);

    expect(prompt).toContain("talk_page_correlated");
    expect(prompt).toContain("source reliability");
    expect(prompt).not.toContain("== Talk page");
    expect(prompt).not.toContain("wikitext");
  });

  it("system prompt mentions discussionType for talk events", () => {
    const systemPrompt = `You are a wiki edit classifier. Given a list of evidence events describing what changed between revisions, classify each event's semantic meaning. For each event, respond with:
- semanticChange: a concise description of what the change means semantically (e.g., "factual claim removed", "attribution strengthened", "sentence reworded without changing meaning")
- confidence: a score from 0.0 to 1.0 indicating how certain you are
- policyDimension (optional): if the change touches a Wikipedia policy, use one of: verifiability, npov, blp, due_weight, protection, edit_warring, notability, copyright, civility
- discussionType (optional, only for talk_page_correlated events): classify the type of talk page discussion using one of: notability_challenge, sourcing_dispute, neutrality_concern, content_deletion, content_addition, naming_dispute, procedural, other

Return ONLY a JSON array of objects with fields: eventIndex (matching the input array index), semanticChange, confidence, policyDimension, discussionType.`;

    expect(systemPrompt).toContain("discussionType");
    expect(systemPrompt).toContain("sourcing_dispute");
    expect(systemPrompt).toContain("notability_challenge");
    expect(systemPrompt).toContain("neutrality_concern");
    expect(systemPrompt).toContain("other");
  });

  it("ModelInterpretation type includes discussionType", () => {
    const mi: ModelInterpretation = {
      semanticChange: "talk page discussion about sourcing",
      confidence: 0.85,
      discussionType: "sourcing_dispute",
    };
    expect(mi.discussionType).toBe("sourcing_dispute");
    expect(mi.confidence).toBe(0.85);
  });

  it("handles mixed event batches with talk events", () => {
    const events = [
      makeEditEvent(1, "claim_removed"),
      makeTalkCorrelatedEvent(1, "time_delta_hours=48 talk_comment=discussing notability"),
      makeEditEvent(2, "citation_added"),
    ];

    const prompt = buildUserPrompt(events);
    expect(prompt).toContain("claim_removed");
    expect(prompt).toContain("talk_page_correlated");
    expect(prompt).toContain("citation_added");
    expect(events.length).toBe(3);
  });

  it("only passes L1-extracted facts, not raw wikitext", () => {
    const events = [makeTalkCorrelatedEvent(1, "time_delta_hours=6 talk_comment=BLP concern")];

    const containsWikitext = events.some((e) =>
      e.deterministicFacts.some((f) =>
        f.detail && (f.detail.includes("\n==") || f.detail.includes("{{") || f.detail.includes("[[")),
      ),
    );
    expect(containsWikitext).toBe(false);
  });
});
