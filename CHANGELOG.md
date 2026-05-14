# Changelog

## 0.2.1 (2026-05-13)

### Examples (new)

Six migration-audience tutorial scripts covering claim provenance, WikiWho
equivalent, ORES equivalent, from-scratch migration, Wikidata editorial depth,
and L2 custom adapter deep dive. See `examples/README.md`.

Dual-licensed: CC0-1.0 (scripts) + AGPL-3.0 (everything else).

### L1-02: Talk Page Correlation

New `correlateTalkRevisions()` analyzer matches article revision timestamps to
nearby talk page revision timestamps (configurable window, default 7 days before
to 3 days after). Produces `talk_page_correlated` events. Integrated into the
analyze command pipeline.

### L1-07: Re-Observation / Temporal Diff

New `--since <iso-timestamp>` flag for the `analyze` command. Fetches only
revisions after the given timestamp and diffs the event stream against the prior
observation (persisted to `~/.wikihistory/observations/`). Shows delta of new,
resolved, and unchanged events.

### L1-08: Talk Page Section Extractor

New `parseTalkThreads()` function extracts threaded discussion structure (sections,
replies, participants, timestamps, resolved status). New event types:
`talk_thread_opened`, `talk_thread_archived`, `talk_reply_added`.

### L1-09: Template Parameter Differ

Extended `template-tracker.ts` with `diffTemplateParams()` and
`buildParamChangeEvents()`. Diffs parameter key-value pairs on templates present
in both revisions. New event type: `template_parameter_changed`.

### L2-01: Talk Page Interpretation

Added `discussionType` field to `ModelInterpretation`. Extended default system
prompt with talk page discussion type taxonomy (notability_challenge,
sourcing_dispute, neutrality_concern, content_deletion, content_addition,
naming_dispute, procedural, other). Model receives only L1-extracted
deterministic facts — never raw wikitext.

### INFRA-01: Real L3 Eval with Ground Truth

New `OutcomeLabel` type and `validateAgainstGroundTruth()` function. Ground
truth dataset of 5 manually curated labels covering RFC closures, talk page
consensus, and page protection events. New `--ground-truth builtin | <path>`
flag for `wikihistory eval`. CLI validates pipeline signal against independent
outcome labels.

### Test Coverage (expanded from 12 files to 20)

New test files:
- heuristic-classifier, wikitext-parser, protection-tracker, revert-detector — 0→full coverage
- rate-limiter, mediawiki-client (mocked) — 0→full coverage
- adapter (createAdapter, parseInterpretations, ConsensusAdapter) — 0→full coverage
- eval harness (evaluate, benchmarkPages, computeScores) — 0→full coverage
- persistence (all 7 methods via bun:sqlite mock) — 0→full coverage
- claim-utils (stripWikitext, fuzzyFindClaim, findSectionForText) — 0→full coverage
- parseFlag — 0→full coverage

Extended existing tests:
- section-differ: added extractSections + diffSections (was buildSectionLineage-only)
- template-tracker: added extractTemplates + diffTemplates (was param-differ-only)
- hash-identity: added createEventIdentity (was createClaimIdentity-only)
- replay-manifest: created (was 0 tests)

Total: 30 test files, 251 tests passing.

## 0.1.0 (2025-01-01)

Initial release.

### Packages

- `@var-ia/evidence-graph` 0.2.0 — core types and schemas
- `@var-ia/ingestion` 0.2.0 — Wikimedia API adapters
- `@var-ia/analyzers` 0.2.0 — deterministic analyzers
- `@var-ia/interpreter` 0.1.0 — model adapter interface
- `@var-ia/cli` 0.3.0 — CLI tool
- `@var-ia/persistence` 0.1.0 — SQLite persistence
- `@var-ia/eval` 0.1.0 — evaluation harness
