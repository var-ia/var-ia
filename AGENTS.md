# Agent Instructions for varia

Varia is the open-source deterministic L1 observation engine built and maintained
by [NextConsensus](https://nextconsensus.com). The engine powers NextConsensus's
proprietary Review Briefs — community improvements to this repo automatically
upgrade the commercial pipeline through a single adapter boundary.

## Build & Verify Commands

```bash
bun run build       # tsc -b (composite project references, all packages)
bun run typecheck   # tsc --noEmit (full typecheck, no emit)
bun run lint        # eslint packages/
bun run test        # vitest run (runs *.test.ts across all packages)
bun run clean       # rm -rf packages/*/dist
```

**Gate**: `bun run build && bun run lint && bun run typecheck && bun run test` must pass before merge.

## Package Manager & Runtime

- **Runtime**: Bun (do not use npm/yarn/pnpm — use `bun` for install, run, and test)
- **Module system**: ESM (`"type": "module"` in root package.json)

## Monorepo Structure

```
packages/
├── evidence-graph/   # Core types/schemas (no deps) — Published
├── ingestion/        # Wikimedia API adapters — Published
├── analyzers/        # Deterministic analyzers (section, citation, revert, template) — Published
├── interpreter/      # Model adapter interface (L2) — Published
├── cli/              # CLI tool (wikihistory) — Published
├── persistence/      # SQLite persistence (bun:sqlite) — Not published
└── eval/             # Evaluation harness (L3) — Not published
```

Each package has `src/index.ts` as its public barrel. `dist/` is build output.

## Architecture (Three-Knowledge-Split)

- **L1** (Deterministic): Wikipedia fetch, diffs, sections, citations, reverts. No model. Byte-for-byte reproducible.
- **L2** (Model-Assisted): Pluggable model adapter. Receives only L1 evidence (never raw wikitext). Every interpretation carries a confidence score.
- **L3** (Independent Ground Truth): Talk page consensus, RFC closures, ArbCom decisions. Never redefined by L1/L2.

Invariants (from ARCHITECTURE.md):
1. L1 never calls a model
2. L2 never sees raw Wikipedia text
3. L3 is never redefined by L1 or L2
4. No single accuracy score conflates layers
5. Every interpretation carries a confidence score
6. Deterministic facts are always presented before interpretations

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
- **String literal union members**: snake_case (`"citation_added"`, `"claim_removed"`)
- **Config types**: PascalCase with `Config` suffix (`ModelConfig`)

### Tests
- Framework: Vitest with `globals: true` (no need to import `describe`/`it`/`expect`)
- Location: `src/__tests__/*.test.ts` (excluded from tsc via tsconfig `exclude`)
- Timeout: 30s default (configurable per-test for integration tests hitting live Wikipedia API)

### General
- No comments unless explaining a non-obvious constraint (not what code does — what it must not do)
- Deterministic code before model code in any file
- Model code never receives raw text — only pre-extracted evidence
- Export only what's needed from each package's `index.ts`

## Commit Convention

Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`.

## PR Requirements (from CONTRIBUTING.md)

- PR description must state what the code shows, not what it claims
- New analyzers must include an eval (even a single sample page)
- Model prompt changes must include before/after confidence scores on 3 sample pages
- Architecture changes require an ARCHITECTURE.md update in the same PR

## Forbidden Contributions

Features that: target individual editors, do sentiment/toxicity scoring, predict/forecast, automate Wikipedia editing, make truth/accuracy claims about content, or use healthcare-specific vocabulary.
