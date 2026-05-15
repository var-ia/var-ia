import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { runAnalyze } from "./analyze.js";

type EvalModule = any;

async function loadEval(): Promise<EvalModule> {
  try {
    return await import("@refract-org/eval") as EvalModule;
  } catch {
    throw new Error("eval command requires @refract-org/eval.\nInstall it: bun add @refract-org/eval");
  }
}

export async function runEval(pageTitleOverride?: string, groundTruthPath?: string): Promise<void> {
  const mod = await loadEval();

  if (groundTruthPath) {
    await runGroundTruth(groundTruthPath, mod.validateAgainstGroundTruth, mod.GROUND_TRUTH_LABELS);
    return;
  }

  const harness = mod.createEvalHarness();
  const testCases = harness.benchmarkPages() as Array<{
    id: string;
    pageTitle: string;
    description: string;
    expectedEvents: { description: string }[];
  }>;

  const filtered = pageTitleOverride ? testCases.filter((t) => t.pageTitle === pageTitleOverride) : testCases;

  console.log(`Running ${filtered.length} benchmark tests...\n`);

  const results = [];
  for (const test of filtered) {
    console.log(`[${test.id}] ${test.description}...`);
    try {
      const { events } = await runAnalyze(test.pageTitle, "detailed");
      const result = harness.evaluate(test, events);
      results.push(result);
      const icon = result.passed ? "PASS" : "FAIL";
      console.log(
        `  ${icon} precision=${result.precision.toFixed(2)} events=${result.eventCount.actual}/${result.eventCount.expected}`,
      );
    } catch (err) {
      console.log(`  ERROR: ${err}`);
      results.push({
        testId: test.id,
        passed: false,
        precision: 0,
        eventCount: { expected: test.expectedEvents.length, actual: 0 },
        matches: [],
        misses: test.expectedEvents.map((e: { description: string }) => ({ expected: e })),
        falsePositives: [],
      });
    }
  }

  const summary = harness.computeScores(results);
  console.log(`\n=== Eval Summary ===`);
  console.log(`Passed: ${summary.testsPassed}/${summary.totalTests}`);
  console.log(`Overall precision: ${(summary.overallPrecision * 100).toFixed(1)}%`);
}

async function runGroundTruth(
  path: string,
  validateAgainstGroundTruth: (...args: unknown[]) => {
    perOutcome: { outcomeId: string; passed: boolean; precision: number; recall: number; matchedEvents: unknown[] }[];
  },
  GROUND_TRUTH_LABELS: unknown[],
): Promise<void> {
  let labels = GROUND_TRUTH_LABELS;

  if (path !== "builtin") {
    try {
      const { readFileSync } = await import("node:fs");
      const raw = readFileSync(path, "utf-8");
      labels = JSON.parse(raw);
      console.log(`Loaded ${(labels as unknown[]).length} ground truth labels from ${path}`);
    } catch (err) {
      console.error(`Failed to load ground truth from ${path}: ${(err as Error).message}`);
      process.exit(1);
    }
  } else {
    console.log(`Using ${(labels as unknown[]).length} built-in ground truth labels.\n`);
  }

  const allEvents: Array<{ outcomeId: string; events: EvidenceEvent[] }> = [];

  for (const label of labels as Array<{ id: string; pageTitle: string; description: string }>) {
    console.log(`[${label.id}] ${label.description}...`);
    try {
      const { events } = await runAnalyze(label.pageTitle, "detailed");
      allEvents.push({ outcomeId: label.id, events });
      console.log(`  Fetched ${events.length} events for "${label.pageTitle}".`);
    } catch (err) {
      console.log(`  ERROR: ${err}`);
      allEvents.push({ outcomeId: label.id, events: [] });
    }
  }

  const allResults = (labels as Array<{ id: string }>).map((label) => {
    const entry = allEvents.find((e) => e.outcomeId === label.id);
    return validateAgainstGroundTruth([label], entry?.events ?? []);
  });

  let totalPassed = 0;
  let totalFailed = 0;
  let totalPrecision = 0;
  let totalRecall = 0;

  console.log(`\n=== L3 Ground Truth Validation ===`);
  for (const result of allResults) {
    const r = result.perOutcome[0];
    const icon = r.passed ? "PASS" : "FAIL";
    console.log(
      `  [${icon}] ${r.outcomeId}: prec=${r.precision.toFixed(2)} recall=${r.recall.toFixed(2)} matched=${r.matchedEvents.length}`,
    );
    if (r.passed) totalPassed++;
    else totalFailed++;
    totalPrecision += r.precision;
    totalRecall += r.recall;
  }

  const count = allResults.length;
  console.log(`\n  Total: ${totalPassed}/${count} passed (${totalFailed} failed)`);
  console.log(`  Avg precision: ${((totalPrecision / count) * 100).toFixed(1)}%`);
  console.log(`  Avg recall: ${((totalRecall / count) * 100).toFixed(1)}%`);
}
