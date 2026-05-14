import {
  createEvalHarness,
  GROUND_TRUTH_LABELS,
  printBenchmarkResult,
  runL2Benchmark,
  validateAgainstGroundTruth,
} from "@var-ia/eval";
import type { EvidenceEvent } from "@var-ia/evidence-graph";
import type { ModelConfig } from "@var-ia/interpreter";
import { runAnalyze } from "./analyze.js";

export async function runEval(
  pageTitleOverride?: string,
  groundTruthPath?: string,
  l2Benchmark?: boolean,
  modelConfig?: ModelConfig,
): Promise<void> {
  if (l2Benchmark) {
    await runL2Eval(modelConfig);
    return;
  }

  if (groundTruthPath) {
    await runGroundTruth(groundTruthPath);
    return;
  }

  const harness = createEvalHarness();
  const testCases = harness.benchmarkPages();

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
        misses: test.expectedEvents.map((e) => ({ expected: e })),
        falsePositives: [],
      });
    }
  }

  const summary = harness.computeScores(results);
  console.log(`\n=== Eval Summary ===`);
  console.log(`Passed: ${summary.testsPassed}/${summary.totalTests}`);
  console.log(`Overall precision: ${(summary.overallPrecision * 100).toFixed(1)}%`);
}

async function runL2Eval(modelConfig?: ModelConfig): Promise<void> {
  const providers: ModelConfig[] = [];

  if (modelConfig) {
    providers.push(modelConfig);
  } else {
    // Try all configured env vars
    if (process.env.OPENAI_API_KEY) {
      providers.push({ provider: "openai", model: "gpt-4o" });
    }
    if (process.env.ANTHROPIC_API_KEY) {
      providers.push({ provider: "anthropic", model: "claude-sonnet-4-20250514" });
    }
    if (process.env.DEEPSEEK_API_KEY) {
      providers.push({ provider: "deepseek", model: "deepseek-chat" });
    }
  }

  if (providers.length === 0) {
    console.log("No model provider configured.\n");
    console.log("Available synthetic test cases:");
    const { buildL2Dataset } = await import("@var-ia/eval");
    const dataset = buildL2Dataset();
    for (const tc of dataset) {
      console.log(`  ${tc.id}: ${tc.description} (${tc.events.length} events)`);
    }
    console.log(`\nSet OPENAI_API_KEY, ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY to run benchmarks.`);
    return;
  }

  const result = await runL2Benchmark(providers);
  printBenchmarkResult(result);
}

async function runGroundTruth(path: string): Promise<void> {
  let labels = GROUND_TRUTH_LABELS;

  if (path !== "builtin") {
    try {
      const { readFileSync } = await import("node:fs");
      const raw = readFileSync(path, "utf-8");
      labels = JSON.parse(raw);
      console.log(`Loaded ${labels.length} ground truth labels from ${path}`);
    } catch (err) {
      console.error(`Failed to load ground truth from ${path}: ${(err as Error).message}`);
      process.exit(1);
    }
  } else {
    console.log(`Using ${labels.length} built-in ground truth labels.\n`);
  }

  const allEvents: Array<{ outcomeId: string; events: EvidenceEvent[] }> = [];

  for (const label of labels) {
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

  const allResults = labels.map((label) => {
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
