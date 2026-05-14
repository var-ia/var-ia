---
id: INFRA-03
status: ready
priority: 12
dependencies: [L2-01, INFRA-01]
packages: [eval, interpreter]
layer: INFRA
effort: large
---

# L2 Quality Benchmarks

## What
Build an L2 evaluation harness that scores model interpretation accuracy against human-rated baselines. Measures semantic change classification, policy dimension tagging, and discussion type classification for each provider.

## Why
INFRA-01 validates L1 against ground truth. But L2 interpretations come from models with varying accuracy — no one has measured whether OpenAI's `discussionType` classifier beats Anthropic's. Without benchmarks, "confidence score" is just a number the model made up.

## Context
Read first:
- `packages/eval/src/index.ts` — existing eval harness pattern (EvalTestCase, computeScores)
- `packages/interpreter/src/index.ts` — ModelAdapter interface, ModelInterpretation shape
- `packages/eval/src/ground-truth.ts` — dataset pattern for manually curated labels

## Implementation
1. Create `packages/eval/src/l2-benchmark.ts` with:
   - `L2TestCase` type: `{ events: EvidenceEvent[], expected: Partial<ModelInterpretation>[] }`
   - `L2BenchmarkHarness` that runs through all configured providers and compares output to expected
2. Create a dataset of 10-15 synthetic event sequences with human-rated expected interpretations
3. Score each provider on: semanticChange accuracy, policyDimension accuracy, discussionType accuracy
4. Output comparison table: provider × accuracy × avg confidence
5. Add `wikihistory eval --l2` command to run benchmarks

## Invariants
- Benchmark events are synthetic — deterministic, reproducible, no API calls needed
- Human ratings are never model-generated
- Each provider is scored independently — no ensemble/composite scores

## Acceptance
- [ ] 10+ synthetic test cases with human-rated expected interpretations
- [ ] Benchmarks run against configured provider (no API key = skip)
- [ ] Output shows per-metric accuracy scores
- [ ] Gate: build, lint, typecheck, test
