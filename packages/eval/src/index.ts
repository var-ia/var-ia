import type { EvidenceEvent } from "@wikipedia-provenance/evidence-graph";

export interface EvalTestCase {
  id: string;
  description: string;
  pageTitle: string;
  pageId: number;
  revisionRange: { from: number; to: number };
  expectedEvents: ExpectedEvent[];
  tolerance?: EvalTolerance;
}

export interface ExpectedEvent {
  eventType: string;
  section: string;
  minConfidence?: number;
}

export interface EvalTolerance {
  minEventCount?: number;
  maxEventCount?: number;
  minPrecision?: number;
}

export interface EvalResult {
  testId: string;
  passed: boolean;
  precision: number;
  eventCount: { expected: number; actual: number };
  matches: EventMatch[];
  misses: MissingEvent[];
  falsePositives: UnexpectedEvent[];
}

export interface EventMatch {
  expected: ExpectedEvent;
  actual: EvidenceEvent;
}

export interface MissingEvent {
  expected: ExpectedEvent;
}

export interface UnexpectedEvent {
  event: EvidenceEvent;
}

export interface EvalHarness {
  evaluate(
    test: EvalTestCase,
    events: EvidenceEvent[],
  ): EvalResult;
  benchmarkPages(): EvalTestCase[];
  computeScores(results: EvalResult[]): EvalScoreSummary;
}

export interface EvalScoreSummary {
  overallPrecision: number;
  testsPassed: number;
  testsFailed: number;
  totalTests: number;
  perTest: Array<{ id: string; precision: number; passed: boolean }>;
}

export function createEvalHarness(): EvalHarness {
  return {
    evaluate(test, events) {
      const matches: EventMatch[] = [];
      const misses: MissingEvent[] = [];
      const falsePositives: UnexpectedEvent[] = [];

      for (const expected of test.expectedEvents) {
        const found = events.find(
          (e) =>
            e.eventType === expected.eventType &&
            e.section === expected.section,
        );
        if (found) {
          matches.push({ expected, actual: found });
        } else {
          misses.push({ expected });
        }
      }

      for (const event of events) {
        if (!test.expectedEvents.some((e) => e.eventType === event.eventType)) {
          falsePositives.push({ event });
        }
      }

      const matchedCount = matches.length;
      const totalExpected = test.expectedEvents.length;
      const precision =
        totalExpected > 0
          ? matchedCount / totalExpected
          : events.length === 0
            ? 1.0
            : 0.0;

      const tolerance = test.tolerance ?? {};
      const minEventCount = tolerance.minEventCount ?? 0;
      const maxEventCount = tolerance.maxEventCount ?? Infinity;
      const minPrecision = tolerance.minPrecision ?? 0.5;

      const passed =
        precision >= minPrecision &&
        events.length >= minEventCount &&
        events.length <= maxEventCount;

      return {
        testId: test.id,
        passed,
        precision,
        eventCount: { expected: totalExpected, actual: events.length },
        matches,
        misses,
        falsePositives,
      };
    },

    benchmarkPages(): EvalTestCase[] {
      return [];
    },

    computeScores(results) {
      const passed = results.filter((r) => r.passed);
      const totalPrecision =
        results.length > 0
          ? results.reduce((sum, r) => sum + r.precision, 0) / results.length
          : 0;

      return {
        overallPrecision: totalPrecision,
        testsPassed: passed.length,
        testsFailed: results.length - passed.length,
        totalTests: results.length,
        perTest: results.map((r) => ({
          id: r.testId,
          precision: r.precision,
          passed: r.passed,
        })),
      };
    },
  };
}
