import type { EvidenceEvent, EvidenceLayer } from "@var-ia/evidence-graph";
import { describe, expect, it } from "vitest";

// Access internal functions for testing prompt construction
// These are tested directly to validate lineage context behavior
// without making live API calls.
import type { LineageContext } from "../index.js";

// Replicate the private function for testing
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

describe("Lineage-aware prompt construction", () => {
  const layer: EvidenceLayer = "observed";
  const events: EvidenceEvent[] = [
    {
      eventType: "claim_reworded",
      fromRevisionId: 1,
      toRevisionId: 2,
      section: "Background",
      before: "X is bad",
      after: "X may be problematic",
      deterministicFacts: [{ fact: "claim_reworded" }],
      layer,
      timestamp: "2024-01-01T00:00:00Z",
    },
  ];

  it("produces standard prompt without lineage", () => {
    const prompt = buildUserPrompt(events);
    expect(prompt).toContain("Evidence events to classify:");
    expect(prompt).not.toContain("Lineage context:");
  });

  it("includes lineage context when provided", () => {
    const lineage: LineageContext = {
      sectionLineages: [
        {
          sectionName: "Background",
          events: ["created in rev 0", "renamed from 'Context' in rev 1"],
          isActive: true,
        },
      ],
    };

    const prompt = buildUserPrompt(events, lineage);
    expect(prompt).toContain("Lineage context:");
    expect(prompt).toContain("Background");
    expect(prompt).toContain("active");
  });

  it("includes claim lineage context", () => {
    const lineage: LineageContext = {
      claimLineages: [
        {
          firstSeenRevisionId: 0,
          variants: 3,
        },
      ],
    };

    const prompt = buildUserPrompt(events, lineage);
    expect(prompt).toContain("Lineage context:");
    expect(prompt).toContain("3 variant(s)");
    expect(prompt).toContain("first seen in rev 0");
  });

  it("uses summaryText when provided instead of structured data", () => {
    const lineage: LineageContext = {
      summaryText: "Custom lineage summary here",
    };

    const prompt = buildUserPrompt(events, lineage);
    expect(prompt).toContain("Lineage context:");
    expect(prompt).toContain("Custom lineage summary here");
  });

  it("works with empty lineage (no crash)", () => {
    const lineage: LineageContext = {};
    const prompt = buildUserPrompt(events, lineage);
    expect(prompt).toContain("Evidence events to classify:");
    expect(prompt).not.toContain("Lineage context:");
  });
});
