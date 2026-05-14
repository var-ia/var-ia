import { createEvalHarness } from "@var-ia/eval";
import { runAnalyze } from "./analyze.js";

export async function runEval(pageTitleOverride?: string): Promise<void> {
  const harness = createEvalHarness();
  const testCases = harness.benchmarkPages();

  const filtered = pageTitleOverride
    ? testCases.filter(t => t.pageTitle === pageTitleOverride)
    : testCases;

  console.log(`Running ${filtered.length} benchmark tests...\n`);

  const results = [];
  for (const test of filtered) {
    console.log(`[${test.id}] ${test.description}...`);
    try {
      const { events } = await runAnalyze(test.pageTitle, "detailed");
      const result = harness.evaluate(test, events);
      results.push(result);
      const icon = result.passed ? "PASS" : "FAIL";
      console.log(`  ${icon} precision=${result.precision.toFixed(2)} events=${result.eventCount.actual}/${result.eventCount.expected}`);
    } catch (err) {
      console.log(`  ERROR: ${err}`);
      results.push({
        testId: test.id,
        passed: false,
        precision: 0,
        eventCount: { expected: test.expectedEvents.length, actual: 0 },
        matches: [],
        misses: test.expectedEvents.map(e => ({ expected: e })),
        falsePositives: [],
      });
    }
  }

  const summary = harness.computeScores(results);
  console.log(`\n=== Eval Summary ===`);
  console.log(`Passed: ${summary.testsPassed}/${summary.totalTests}`);
  console.log(`Overall precision: ${(summary.overallPrecision * 100).toFixed(1)}%`);
}
