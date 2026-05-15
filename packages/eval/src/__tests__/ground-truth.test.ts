import type { EvidenceEvent } from "@var-ia/evidence-graph";
import { describe, expect, it } from "vitest";
import type { OutcomeLabel } from "../index.js";
import { GROUND_TRUTH_LABELS, getGroundTruthForPage, validateAgainstGroundTruth } from "../index.js";

function makeEvent(eventType: string, section = "body"): EvidenceEvent {
  return {
    eventType: eventType as EvidenceEvent["eventType"],
    fromRevisionId: 1,
    toRevisionId: 2,
    section,
    before: "",
    after: "",
    deterministicFacts: [],
    layer: "observed",
    timestamp: "2022-01-01T00:00:00Z",
  };
}

describe("validateAgainstGroundTruth", () => {
  it("validates a known outcome against a synthetic event stream (should pass)", () => {
    const outcome: OutcomeLabel = {
      id: "test-1",
      source: "talk_page_consensus",
      pageTitle: "Test",
      description: "Article was reorganized per talk page consensus",
      observedAt: "2022-01-01T00:00:00Z",
      resolution: "keep",
      referenceUrl: "https://en.wikipedia.org/wiki/Talk:Test",
      expectedEventTypes: ["section_reorganized", "sentence_removed"],
      expectedSection: "",
    };

    const events = [makeEvent("section_reorganized"), makeEvent("sentence_removed")];

    const result = validateAgainstGroundTruth([outcome], events);

    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.perOutcome[0].passed).toBe(true);
    expect(result.perOutcome[0].signalDetected).toBe(true);
  });

  it("reports misses against an empty event stream", () => {
    const outcome: OutcomeLabel = {
      id: "test-2",
      source: "rfc_closure",
      pageTitle: "Test",
      description: "RFC closed with consensus to delete",
      observedAt: "2022-01-01T00:00:00Z",
      resolution: "delete",
      referenceUrl: "https://en.wikipedia.org/wiki/Talk:Test",
      expectedEventTypes: ["sentence_removed", "section_reorganized"],
    };

    const result = validateAgainstGroundTruth([outcome], []);

    expect(result.perOutcome[0].passed).toBe(false);
    expect(result.perOutcome[0].signalDetected).toBe(false);
    expect(result.perOutcome[0].matchedEvents).toHaveLength(0);
  });

  it("computes precision and recall", () => {
    const outcome: OutcomeLabel = {
      id: "test-3",
      source: "arbcom_decision",
      pageTitle: "Test",
      description: "ArbCom decision resulted in page protection",
      observedAt: "2022-01-01T00:00:00Z",
      resolution: "other",
      referenceUrl: "https://en.wikipedia.org/wiki/Wikipedia:Arbitration",
      expectedEventTypes: ["protection_changed", "revert_detected"],
    };

    const events = [makeEvent("protection_changed")];

    const result = validateAgainstGroundTruth([outcome], events);

    const r = result.perOutcome[0];
    expect(r.precision).toBe(0.5);
    expect(r.recall).toBe(1.0);
    expect(r.matchedEvents).toHaveLength(1);
  });

  it("OutcomeLabel type is never populated from pipeline output", () => {
    const outcome: OutcomeLabel = {
      id: "test-4",
      source: "page_protection",
      pageTitle: "Test",
      description: "Hardcoded ground truth, not pipeline output",
      observedAt: "2022-01-01T00:00:00Z",
      resolution: "other",
      referenceUrl: "https://en.wikipedia.org/wiki/Special:Log",
      expectedEventTypes: ["protection_changed"],
    };
    expect(outcome.source).toBe("page_protection");
    expect(outcome.resolution).toBe("other");
  });
});

describe("GROUND_TRUTH_LABELS", () => {
  it("has at least 3 manually curated labels", () => {
    expect(GROUND_TRUTH_LABELS.length).toBeGreaterThanOrEqual(3);
  });

  it("each label has required fields", () => {
    for (const label of GROUND_TRUTH_LABELS) {
      expect(label.id).toBeTruthy();
      expect(label.pageTitle).toBeTruthy();
      expect(label.source).toMatch(/^(talk_page_consensus|rfc_closure|arbcom_decision|page_protection)$/);
      expect(label.referenceUrl).toMatch(/^https?:\/\//);
      expect(label.expectedEventTypes.length).toBeGreaterThan(0);
    }
  });

  it("getGroundTruthForPage returns labels for known pages", () => {
    const labels = getGroundTruthForPage("Donald Trump");
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(labels[0].pageTitle).toBe("Donald Trump");
  });

  it("getGroundTruthForPage returns empty for unknown pages", () => {
    expect(getGroundTruthForPage("Nonexistent_Page_XYZ")).toEqual([]);
  });
});
