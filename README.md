# Varia

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-0f172a.svg)](./LICENSE)
[![npm scope](https://img.shields.io/badge/npm-%40var--ia-2563eb.svg)](https://www.npmjs.com/org/var-ia)

**Wikipedia page histories, reconstructed as evidence graphs.**

> Evidence, not truth.

A deterministic claim-provenance engine for Wikipedia page histories. This tool reconstructs how claims moved through Wikipedia's editorial system — when they appeared, how they changed, what sources supported them, and what policy signals surrounded each change. It does not determine truth, judge editors, or predict outcomes.

Built and open-sourced by [NextConsensus](https://nextconsensus.com). Varia is the deterministic L1 observation engine used in part of the NextConsensus research workflow: inspectable method, source-bound audit trail, AGPL-3.0.

## Why It Exists

Wikipedia is not a source of truth. It is a public record of contested claims
being rewritten, sourced, challenged, and stabilized over time.

Varia turns that record into structured evidence so downstream reviewers can
separate deterministic observations from policy-coded signals and model-assisted
interpretation.

## What It Does

Given a Wikipedia page URL, the engine produces a structured evidence graph:

- **Timeline** — every revision, what changed, in which section
- **Claim lineage** — when a specific sentence first appeared, how it was reworded, when it was removed
- **Source lineage** — which citations appeared, were replaced, or survived
- **Policy signals** — verifiability, neutrality, BLP, due-weight templates and edit patterns
- **Edit classification** — heuristic categorization of edits (revert, vandalism, sourcing, major addition/removal, cosmetic, minor)
- **Interpretation** — bounded, confidence-labeled model readings: direct accusation → attributed finding, lead prominence → body placement

Every interpretation is tagged with its evidence layer:

![Evidence Label Taxonomy](./docs/diagrams/evidence-labels.svg)

| Label | Meaning |
|-------|---------|
| **Observed** | Deterministic, byte-for-byte reproducible |
| **Policy-coded** | Matches known Wikipedia policy signals |
| **Model interpretation** | LLM-assisted, with confidence score |
| **Speculative** | Below confidence threshold |
| **Unknown** | Insufficient evidence |

## What It Is Not

- ❌ A truth detector
- ❌ An editor quality judge
- ❌ A prediction engine
- ❌ A sentiment analyzer
- ❌ A live-monitoring product
- ❌ A healthcare-specific claim scorer

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| `@var-ia/evidence-graph` | [![npm](https://img.shields.io/npm/v/@var-ia/evidence-graph)](https://www.npmjs.com/package/@var-ia/evidence-graph) | Core types and schemas — claim, evidence, source, report objects |
| `@var-ia/ingestion` | [![npm](https://img.shields.io/npm/v/@var-ia/ingestion)](https://www.npmjs.com/package/@var-ia/ingestion) | Wikimedia API adapters — revision fetching, diffing, rate limiting |
| `@var-ia/analyzers` | [![npm](https://img.shields.io/npm/v/@var-ia/analyzers)](https://www.npmjs.com/package/@var-ia/analyzers) | Deterministic analyzers — sections, citations, reverts, templates |
| `@var-ia/interpreter` | [![npm](https://img.shields.io/npm/v/@var-ia/interpreter)](https://www.npmjs.com/package/@var-ia/interpreter) | Pluggable model adapter for semantic interpretation |
| `@var-ia/persistence` | [![npm](https://img.shields.io/npm/v/@var-ia/persistence)](https://www.npmjs.com/package/@var-ia/persistence) | SQLite persistence layer (Bun-only) |
| `@var-ia/cli` | [![npm](https://img.shields.io/npm/v/@var-ia/cli)](https://www.npmjs.com/package/@var-ia/cli) | CLI tool — `wikihistory` command |
| `@var-ia/eval` | [![npm](https://img.shields.io/npm/v/@var-ia/eval)](https://www.npmjs.com/package/@var-ia/eval) | Evaluation harness with benchmark pages |

## Quick Start

### As a consumer

```bash
bun add @var-ia/cli
wikihistory analyze "COVID-19 pandemic" --depth detailed
wikihistory claim "Theranos" --text "revolutionary blood testing"
```

### Use individual packages

```bash
bun add @var-ia/evidence-graph @var-ia/analyzers
```

```ts
import type { EvidenceEvent, Revision } from "@var-ia/evidence-graph";
import { sectionDiffer, citationTracker } from "@var-ia/analyzers";
```

### As a contributor

```bash
git clone https://github.com/nextconsensus/var-ia
cd varia
bun install && bun run build
bun packages/cli/src/cli.ts analyze "COVID-19 pandemic" --depth detailed
```

![Concept Overview](./docs/diagrams/concept-overview.svg)

## Architecture

The engine follows a three-knowledge-split architecture:

1. **Deterministic** (L1): Wikipedia API ingestion, diff computation, section extraction, citation tracking, template classification, revert detection, heuristic classification — byte-reproducible, no model involved.
2. **Model-assisted** (L2): Semantic change classification, policy-dimension tagging, claim state inference — bounded interpretations with confidence scores.
3. **Outcome labels** (L3): Independently sourced ground truth (talk page consensus, page protection events) — never redefined by the pipeline.

## License

AGPL-3.0. See [LICENSE](./LICENSE).

If you modify this software and deploy it as a network service, you must release your modifications.

## Community

- [Contributing](./CONTRIBUTING.md) — all measurement claims must carry phase tags
- [Code of Conduct](./.github/CODE_OF_CONDUCT.md)
- [Security](./.github/SECURITY.md)
- [Changelog](./CHANGELOG.md)
- [Cite this software](./CITATION.cff)
