---
id: INFRA-01
status: blocked
priority: 9
dependencies: [L1-01, L1-02]
packages: [eval]
layer: L3
effort: large
---

# Real L3 Eval with Ground Truth

## What
Replace the placeholder eval harness with actual L3 ground truth: talk page consensus labels, RFC outcomes, and ArbCom decisions.

## Why
The architecture declares L3 as "independent ground truth — talk page consensus, page protection events, RFC closures, Arbitration Committee decisions" (ARCHITECTURE.md:21-27). But the actual eval package (`packages/eval/src/index.ts`) only checks whether L1 detected the right `eventType` + `section`. L3 doesn't exist in code — it's a declared layer with no implementation. This task makes it real.

## Context
Read first:
- `packages/eval/src/index.ts` — full eval harness: `EvalTestCase`, `EvalResult`, `EvalHarness`, `benchmarkPages()`
- `ARCHITECTURE.md` lines 21-27, 61-71 — L3 description and report layers
- `packages/eval/README.md` — eval package docs
- `packages/evidence-graph/src/schemas/evidence.ts` — `EvidenceEvent`, `EventType`
- The new talk page infrastructure from L1-01 and L1-02 (read once completed)

## Implementation
1. Add an `OutcomeLabel` type to `packages/eval/src/index.ts`:
   ```ts
   interface OutcomeLabel {
     id: string;
     source: "talk_page_consensus" | "rfc_closure" | "arbcom_decision" | "page_protection";
     pageTitle: string;
     description: string;
     observedAt: string; // ISO timestamp
     resolution: string; // e.g., "keep", "merge", "delete", "no_consensus"
     referenceUrl: string; // permalink to the discussion
   }
   ```
2. Create a ground truth dataset `packages/eval/src/ground-truth.ts` with a small initial set of manually curated `OutcomeLabel[]` for 3-5 well-known Wikipedia disputes. These are hardcoded facts, not model output.
3. Add a `validateAgainstGroundTruth(outcomes: OutcomeLabel[], events: EvidenceEvent[]): L3ValidationResult` function that:
   a. For each outcome, checks whether the L1/L2 pipeline detected the corresponding signal
   b. Computes: did the pipeline detect the event type that corresponds to this outcome? (e.g., a "delete" RFC should correlate with `claim_removed` or `section_reorganized` events around the same timestamp)
   c. Returns precision, recall, and a per-outcome report
4. Add a new CLI command or extend the existing `wikihistory eval` to accept `--ground-truth <path>` and validate against the dataset
5. The eval benchmark pages (`benchmarkPages()`) should be extended to reference ground truth labels where available

## Invariants
- L3 is never redefined by L1 or L2 output — outcome labels are independently sourced
- Outcome labels carry public observability timestamps and reference URLs (permalink to the actual discussion)
- The ground truth dataset is human-curated, not model-generated
- L3 validation measures pipeline signal against independent consensus, not against the pipeline's own predictions

## Acceptance
- [ ] Gate: `bun run build && bun run lint && bun run typecheck && bun run test`
- [ ] Write tests in `packages/eval/src/__tests__/` that:
  - Validate a known outcome against a synthetic event stream (should pass)
  - Validate against an empty event stream (should report misses)
  - The `OutcomeLabel` type is never populated from L1/L2 pipeline output
- [ ] Ground truth dataset has at least 3 manually curated labels
- [ ] `wikihistory eval --ground-truth` works end-to-end
- [ ] Update ARCHITECTURE.md if the L3 section needs refinement
- [ ] Update ROADMAP.md status for INFRA-01 to `done`
