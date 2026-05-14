# @var-ia/eval

Generic evaluation harness for L2 model quality — benchmarks, calibration, L3 ground truth validation.

## Exports

### Harness

- `createEvalHarness()` — returns an `EvalHarness` with `evaluate()`, `benchmarkPages()`, and `computeScores()`
- `EvalHarness` — interface for running test cases against evidence events
- `EvalTestCase` — a single benchmark case (page, revision range, expected events)
- `EvalResult` — per-test result with precision, matches, misses, false positives
- `EvalScoreSummary` — aggregate scores across all tests

### L2 Benchmark

- `runL2Benchmark()` — run L2 interpretation benchmark across a synthetic dataset
- `buildL2Dataset()` — construct a benchmark dataset of test cases
- `printBenchmarkResult()` — format benchmark results for display

### Calibration

- `computeCalibration()` — compute calibration scores for model interpretations against expected labels
- `ExpectedInterpretation` — expected interpretation for a calibration case

### L3 Ground Truth

- `validateAgainstGroundTruth()` — validate L1 events against L3 outcome labels
- `GROUND_TRUTH_LABELS` — built-in ground truth labels
- `getGroundTruthById()` / `getGroundTruthForPage()` — lookup helpers
- `OutcomeLabel` — L3 ground truth label type
- `L3ValidationResult` / `L3ValidationSummary` — validation result types

## License

AGPL-3.0
