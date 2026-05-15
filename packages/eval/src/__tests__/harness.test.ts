import type { EvidenceEvent, EvidenceLayer } from "@refract-org/evidence-graph";
import { describe, expect, it } from "vitest";
import type { EvalTestCase } from "../index.js";
import { createEvalHarness } from "../index.js";

function makeEvent(eventType: string, section = "body"): EvidenceEvent {
  const layer: EvidenceLayer = "observed";
  return {
    eventType: eventType as EvidenceEvent["eventType"],
    fromRevisionId: 1,
    toRevisionId: 2,
    section,
    before: "",
    after: "",
    deterministicFacts: [],
    layer,
    timestamp: "2026-01-01T00:00:00Z",
  };
}

describe("createEvalHarness", () => {
  describe("evaluate", () => {
    it("passes when all expected events are found", () => {
      const harness = createEvalHarness();
      const test: EvalTestCase = {
        id: "test-1",
        description: "All events present",
        pageTitle: "Test",
        pageId: 1,
        revisionRange: { from: 0, to: 0 },
        expectedEvents: [
          { eventType: "revert_detected", section: "body" },
          { eventType: "citation_added", section: "body" },
        ],
        tolerance: { minPrecision: 0.5 },
      };

      const result = harness.evaluate(test, [makeEvent("revert_detected"), makeEvent("citation_added")]);

      expect(result.passed).toBe(true);
      expect(result.matches).toHaveLength(2);
      expect(result.misses).toHaveLength(0);
      expect(result.precision).toBe(1.0);
    });

    it("fails when expected events are missing", () => {
      const harness = createEvalHarness();
      const test: EvalTestCase = {
        id: "test-2",
        description: "Missing events",
        pageTitle: "Test",
        pageId: 1,
        revisionRange: { from: 0, to: 0 },
        expectedEvents: [{ eventType: "revert_detected", section: "body" }],
        tolerance: { minPrecision: 0.5 },
      };

      const result = harness.evaluate(test, []);
      expect(result.passed).toBe(false);
      expect(result.misses).toHaveLength(1);
    });

    it("reports false positives", () => {
      const harness = createEvalHarness();
      const test: EvalTestCase = {
        id: "test-3",
        description: "Unexpected events",
        pageTitle: "Test",
        pageId: 1,
        revisionRange: { from: 0, to: 0 },
        expectedEvents: [{ eventType: "revert_detected", section: "body" }],
        tolerance: { minPrecision: 0.5 },
      };

      const result = harness.evaluate(test, [makeEvent("revert_detected"), makeEvent("citation_added")]);

      expect(result.falsePositives).toHaveLength(1);
    });

    it("respects event count tolerance", () => {
      const harness = createEvalHarness();
      const test: EvalTestCase = {
        id: "test-4",
        description: "Event count bounds",
        pageTitle: "Test",
        pageId: 1,
        revisionRange: { from: 0, to: 0 },
        expectedEvents: [{ eventType: "revert_detected", section: "body" }],
        tolerance: { minEventCount: 3 },
      };

      const result = harness.evaluate(test, [makeEvent("revert_detected")]);
      expect(result.passed).toBe(false);
    });

    it("matches by event type and section", () => {
      const harness = createEvalHarness();
      const test: EvalTestCase = {
        id: "test-5",
        description: "Section matching",
        pageTitle: "Test",
        pageId: 1,
        revisionRange: { from: 0, to: 0 },
        expectedEvents: [{ eventType: "section_reorganized", section: "(lead)" }],
        tolerance: { minPrecision: 0.5 },
      };

      const wrongSection = makeEvent("section_reorganized", "body");
      const result = harness.evaluate(test, [wrongSection]);
      expect(result.misses).toHaveLength(1);
    });
  });

  describe("benchmarkPages", () => {
    it("returns at least 5 benchmark pages", () => {
      const harness = createEvalHarness();
      const pages = harness.benchmarkPages();
      expect(pages.length).toBeGreaterThanOrEqual(5);
    });

    it("each benchmark has required fields", () => {
      const harness = createEvalHarness();
      for (const page of harness.benchmarkPages()) {
        expect(page.id).toBeTruthy();
        expect(page.pageTitle).toBeTruthy();
        expect(page.expectedEvents.length).toBeGreaterThan(0);
      }
    });
  });

  describe("computeScores", () => {
    it("computes overall precision", () => {
      const harness = createEvalHarness();
      const test: EvalTestCase = {
        id: "t",
        description: "t",
        pageTitle: "T",
        pageId: 1,
        revisionRange: { from: 0, to: 0 },
        expectedEvents: [{ eventType: "revert_detected", section: "body" }],
        tolerance: { minPrecision: 0.5 },
      };

      const r1 = harness.evaluate(test, [makeEvent("revert_detected")]);
      const r2 = harness.evaluate(test, []);
      const summary = harness.computeScores([r1, r2]);

      expect(summary.overallPrecision).toBe(0.5);
      expect(summary.testsPassed).toBe(1);
      expect(summary.testsFailed).toBe(1);
      expect(summary.totalTests).toBe(2);
    });

    it("returns zero for empty results", () => {
      const harness = createEvalHarness();
      const summary = harness.computeScores([]);
      expect(summary.overallPrecision).toBe(0);
      expect(summary.totalTests).toBe(0);
    });
  });
});
