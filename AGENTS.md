# Agent Instructions for varia

Refract is the open-source deterministic observation engine built and maintained
by [NextConsensus](https://nextconsensus.com). It is domain-neutral
infrastructure for MediaWiki and public revision histories.

## Repository Boundary

Refract = generic public-knowledge observability
NextConsensus = healthcare-specific decision intelligence

Repository boundary: read `docs/repository-boundary.md` before adding scope.
Refract observes change. NextConsensus judges healthcare decision relevance.

## Build & Verify Commands

```bash
bun run build       # tsc -b (composite project references, all packages)
bun run typecheck   # tsc --noEmit (full typecheck, no emit)
bun run lint        # biome lint packages/
bun run format      # biome format --write packages/
bun run test        # vitest run (runs *.test.ts across all packages)
bun run clean       # rm -rf packages/*/dist
```

**Gate**: `bun run build && bun x biome ci packages/ && bun run typecheck && bun run check:boundaries && bun run test` must pass before merge.

## Package Manager & Runtime

- **Runtime**: Bun (do not use npm/yarn/pnpm — use `bun` for install, run, and test)
- **Module system**: ESM (`"type": "module"` in root package.json)

## Monorepo Structure

```
packages/
├── evidence-graph/   # Core types/schemas (no deps) — Published
├── ingestion/        # Wikimedia API adapters — Published
├── analyzers/        # Deterministic analyzers (section, citation, revert, template) — Published
├── cli/              # CLI tool (wikihistory) — Published
├── persistence/      # SQLite persistence (bun:sqlite) — Not published
├── eval/             # Evaluation harness (L3) — Not published
└── observable/       # Observable Framework data loader — Not published
```

Each package has `src/index.ts` as its public barrel. `dist/` is build output.

## Architecture (Two-Knowledge-Split)

- **Layer 1** (Deterministic): Wikipedia fetch, diffs, sections, citations, reverts. No model. Byte-for-byte reproducible.
- **Layer 2** (Independent Ground Truth): Talk page consensus, RFC closures, ArbCom decisions. Never redefined by pipeline output.
- **Downstream interpretation**: Model-assisted L2 lives in NextConsensus, which consumes Refract's deterministic event stream without modifying it.

## Code Conventions

### Imports
- **Cross-package types**: `import type { Foo } from "@var-ia/evidence-graph"`
- **Cross-package runtime**: `import { Bar } from "@var-ia/analyzers"`
- **Intra-package**: Use relative paths with `.js` extension: `import { baz } from "./baz.js"`
- **Node built-ins**: `import { createHash } from "node:crypto"`
- **Bun built-ins**: `import { Database } from "bun:sqlite"`

Always prefer `import type` for type-only imports. Never import from `dist/` in source code (tests may do so for dynamic integration testing).

### Naming
- **Files**: kebab-case (`mediawiki-client.ts`, `section-differ.ts`)
- **Interfaces/types**: PascalCase (`RevisionFetcher`, `EvidenceEvent`)
- **Functions**: camelCase (`createClaimIdentity`, `fetchRevisions`)
- **Const singletons**: camelCase (`sectionDiffer`, `citationTracker`)
- **String literal union members**: snake_case (`"citation_added"`, `"page_moved"`)
- **Config types**: PascalCase with `Config` suffix (`EvalConfig`)

### Tests
- Framework: Vitest with `globals: true` (no need to import `describe`/`it`/`expect`)
- Location: `src/__tests__/*.test.ts` (excluded from tsc via tsconfig `exclude`)
- Timeout: 30s default (configurable per-test for integration tests hitting live Wikipedia API)

### General
- No comments unless explaining a non-obvious constraint (not what code does — what it must not do)
- Export only what's needed from each package's `index.ts`

## Commit Convention

Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`.

## PR Requirements (from CONTRIBUTING.md)

- PR description must state what the code shows, not what it claims
- New analyzers must include an eval (even a single sample page)
- Architecture changes require an ARCHITECTURE.md update in the same PR

## Roadmap & Work Queue

- **ROADMAP.md** — prioritized items by layer, with status table and dependency graph
- **`.github/workqueue/{ID}.md`** — self-contained task prompts for agents to pick up
- `ready` = unblocked, can be started; `blocked` = waiting on dependencies
- After completing a task: (1) run gate, (2) update task status to `done`, (3) update ROADMAP.md to unblock dependents
- Task file format: YAML frontmatter (id, status, priority, dependencies, packages, layer, effort) followed by What/Why/Context/Implementation/Invariants/Acceptance sections

## Forbidden Contributions

Features that: target individual editors, do sentiment/toxicity scoring, predict/forecast, automate Wikipedia editing, make truth/accuracy claims about content, or use healthcare-specific vocabulary.

Do not add payer, guideline, clinical, regulatory, customer-workflow,
healthcare decision-judgment, domain-specific source-weighting, decision
threshold, production-backtest, outcome-data, model interpretation,
model adapters, model routing, model consensus, or NextConsensus-private
logic to this repo. Keep Refract agents focused on determinism, not judgment.
