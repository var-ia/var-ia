# @var-ia/eval

Evaluation harness for ground truth validation and benchmark pages.

```bash
bun add @var-ia/eval
```

## Exports

### Harness

- `createEvalHarness()` — returns an `EvalHarness` with `evaluate()`, `benchmarkPages()`, and `computeScores()`
- `EvalHarness` — interface for running test cases against evidence events
- `EvalTestCase` — a single benchmark case (page, revision range, expected events)
- `EvalResult` — per-test result with precision, matches, misses, false positives
- `EvalScoreSummary` — aggregate scores across all tests

### Ground Truth

- `validateAgainstGroundTruth()` — validate events against outcome labels
- `GROUND_TRUTH_LABELS` — built-in ground truth labels
- `getGroundTruthById()` / `getGroundTruthForPage()` — lookup helpers
- `OutcomeLabel` — ground truth label type
- `L3ValidationResult` / `L3ValidationSummary` — validation result types

```ts
import { createEvalHarness, validateAgainstGroundTruth } from "@var-ia/eval";
```

[Sequent](https://github.com/var-ia/sequent) · [Docs](https://github.com/var-ia/sequent-docs) · [npm](https://www.npmjs.com/package/@var-ia/eval)
