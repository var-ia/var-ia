# @var-ia/eval

Evaluation harness — benchmark pages, expected event patterns, precision scoring.

```bash
bun add @var-ia/eval
```

## Exports

### Functions

- `createEvalHarness()` — create an evaluation harness with benchmark pages

### Interfaces

- `EvalTestCase` — test case with page, revision range, expected events, tolerances
- `EvalResult` — pass/fail with precision, matches, misses, false positives
- `EvalScoreSummary` — aggregate scores across multiple tests
- `EvalHarness` — `evaluate(test, events)`, `benchmarkPages()`, `computeScores(results)`
- `ExpectedEvent`, `EventMatch`, `MissingEvent`, `UnexpectedEvent`, `EvalTolerance`

```ts
import { createEvalHarness } from "@var-ia/eval";
import type { EvalTestCase, EvalResult, EvalHarness } from "@var-ia/eval";
```
