# Changelog

## 0.3.1 (2026-05-15)

### Removed
- **@var-ia/interpreter** package deleted — L2 model interpretation moved to NextConsensus
- CLI `--model`, `--model-api-key`, `--model-name`, `--model-endpoint`, `--temperature`, `--prompt`, `--router` flags removed
- Old claim direction event types (`claim_softened`, `claim_strengthened`, `claim_reworded`, `claim_moved`) replaced with mechanical sentence events
- Architecture boundary check scripts cleaned up (no longer checks deleted interpreter package)

### Added
- **@var-ia/evidence-graph**: `buildInterpretationPrompt()`, `parseInterpretationResponse()`, `ModelInterpretationSchema` — format pipeline for bring-your-own-inference
- **MCP server**: `interpret` tool with host-sampling support — requests host LLM via `sampling/createMessage`, no API key management
- **`--format html`** on `wikihistory export` — self-contained interactive report
- **Docker**: GHCR publish workflow (`ghcr.io/var-ia/cli`)

### Fixed
- `@var-ia/persistence` removed from hard CLI deps — `npx @var-ia/cli` no longer fails to install
- `@var-ia/persistence` lazy-imported at runtime; `--cache` requires explicit install
- `wikihistory explore` `--no-open` now actually suppresses browser open (not just the log message)
- `docs/recipes.md` claim tracking example now shows `wikihistory claim` not `wikihistory cron`
- `.env.example` no longer references removed model provider API keys

## 0.3.0 (2026-05-15)

### New L1 analyzers

- **Edit cluster detection** — `detectEditClusters()` groups 3+ rapid edits within a configurable time window. Produces `edit_cluster_detected` events.
- **Talk activity spike detection** — `detectTalkActivitySpikes()` flags anomalous talk page activity (3x moving average). Produces `talk_activity_spike` events.
- **Wikidata entity mapping** — `fetchWikidataId()`, `mapPageToEntity()`, `mapPagesToEntities()` for page-to-Q-ID lookups, entity data, and claim extraction.

### New CLI commands

- **`wikihistory explore <page>`** — starts a local HTTP web server with an interactive timeline, evidence table, diff viewer, and summary view.

### Model adapters hardened

- All 5 adapters (OpenAI, Anthropic, DeepSeek, Ollama, BYOK) now support `timeoutMs` (default 120s) and `maxTokens` (default 4096) configuration.
- Fetch calls use `AbortSignal.timeout()` for deterministic timeouts.
- Interpreter barrel (`index.ts`) split: 381-line file → 6 dedicated adapter files in `adapters/`.
- Removed dead exports (`CalibratedAdapter`, `CascadingRouter`).

### Infrastructure

- **CI pinned to bun 1.2.x** — reproducible builds.
- **Architecture boundary check** — `scripts/check-boundaries.ts` prevents L1→interpreter and L2→ingestion imports, enforced in CI.
- **`.env.example`** added with expected environment variables.
- **Public `@var-ia/eval`** — package made public with full exports, README, and benchmark fixtures (25 seeded labels across 5 pages).

### Documentation

- `docs/events.md` — full event taxonomy with triggers and examples (all 29 event types).
- `docs/naming.md` — explains Varia/var-ia/@var-ia/wikihistory split.
- `docs/mcp.md` — MCP tool reference with connection configs.
- `docs/security.md` — credential exposure, local cache, L2 data flow.
- `docs/recipes.md` — example JSON output added to claim, cron, and diff recipes.
- L2 invariant now reads "never receives full revision wikitext" (was "never sees raw Wikipedia text").

### Bug fixes

- `_toRevId` renamed to `toRevId` (underscore was misleading — parameter IS used).
- `stripWikitext` moved from CLI `claim.ts` to `analyzers/wikitext-parser.ts` (removed duplicate).
- `ReportLayerLabel` consolidated as alias of `EvidenceLayer`.
- Dueling `ExpectedInterpretation` types in eval renamed to `L2ExpectedInterpretation`.
- Stale dist test files cleaned (compiled `__tests__/` in dist were being run by vitest).

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

Total: 41 test files, 602 tests passing.

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
