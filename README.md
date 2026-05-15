# Var-ia

[![CI](https://github.com/var-ia/var-ia/actions/workflows/ci.yml/badge.svg)](https://github.com/var-ia/var-ia/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/release/var-ia/var-ia)](https://github.com/var-ia/var-ia/releases)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-0f172a.svg)](./LICENSE)
[![npm scope](https://img.shields.io/badge/npm-%40var--ia-2563eb.svg)](https://www.npmjs.com/org/var-ia)

**The git log for public knowledge.**

> Evidence, not truth.
>
> **Varia answers:** "What changed?"
> **NextConsensus answers:** "Does this change matter for this healthcare decision?"

Varia is a deterministic observation engine — it ingests revision histories from
Wikipedia, Fandom, and any MediaWiki instance, extracts a structured event stream
of every claim, source, section, and dispute, and makes that stream queryable and
reproducible. No model. No interpretation. Byte-for-byte identical on every run.

Built and maintained by [NextConsensus](https://nextconsensus.com). Varia is
domain-neutral infrastructure for observing how public knowledge changes.
[Repository boundary](./docs/repository-boundary.md).

![Concept Overview](./docs/diagrams/concept-overview.svg)

## Why It Exists

The printing press made knowledge durable by freezing it into editions. Wikipedia
made knowledge mutable by letting the record change continuously. But most systems
still consume only the current surface.

Varia makes the mutation itself legible: who changed what, when, with what evidence,
under what dispute, and whether the change survived. That is the difference between
a library catalogue and an epistemic event log. Revision histories become
infrastructure when machines need to reason about knowledge, not just retrieve it.

Every claim gets provenance — `claim + source + wording + placement + stability
+ time` — a reusable primitive that enables temporal leakage detection, source
cascade analysis, editorial consensus mapping, and anything else that needs
versioned knowledge, not snapshots.

## What It Does

Given a MediaWiki page, the engine produces a structured event stream:

| Dimension | What Varia tracks |
|-----------|-------------------|
| **Claim** | When a sentence first appeared, was removed, or was reintroduced — across every revision |
| **Source** | Which citations were added, replaced, or removed — and in what sequence |
| **Wording** | Text-level changes: sentence additions, removals, section reorganization, lead promotions |
| **Placement** | Where a claim lives: lead, body, infobox, footnote — and when it moved between them |
| **Stability** | Revert cycles, template disputes, talk-page correlations, edit clusters, protection changes |
| **Time** | Every event timestamped, every revision provenance-tagged — byte-for-byte reproducible |

## Who This Is For

- **Investigative journalists** — trace how a claim about a public figure evolved
  across revision history: when it was added, who softened it, when sources
  appeared or disappeared
- **Wikipedia editors** — audit how policy templates (NPOV, BLP, due-weight)
  correlate with content changes over time
- **Data scientists & researchers** — deterministic features for edit-quality
  models, sourcing-behavior studies, content-drift measurement
- **OSINT analysts** — structured event streams from public editorial history,
  reproducible on request
- **Fan wiki communities** — canon disputes, headcanon drift, content-fork
  detection across MediaWiki instances

## Quick Start

```bash
# One command, zero install
npx @var-ia/cli analyze "Bitcoin" --depth brief
```

> **What you're seeing**: These are observed changes — deterministic facts extracted from revision history. Varia reports what changed, not whether a claim is true or false.

What you'll see:

```
Analysis of "Bitcoin" at depth brief found 330 events across 20 revisions.

[2009-03-08] wikilink_added (rev 275832581→275832690)
  Section: body
  target: cryptography

[2009-12-10] citation_added (rev 308164432→308164529)
  Section: (lead)
  ref: sourceforge.net/projects/bitcoin/

[2009-12-12] template_added (rev 308164529→308180771)
  Section: body
  template: primarysources
```

Full output (330 events): [`docs/example-output.md`](./docs/example-output.md).

### Other install options

| Method | Command |
|--------|---------|
| **Bun** (if installed) | `bunx @var-ia/cli analyze "Bitcoin"` |
| **Docker** (prebuilt) | `docker run ghcr.io/var-ia/cli analyze "Bitcoin"` |
| **Local install** | `bun add @var-ia/cli && wikihistory analyze "Bitcoin"` |
| **Build from source** | `git clone https://github.com/var-ia/var-ia && cd varia && bun install && bun run build` |

### Use individual packages

```bash
bun add @var-ia/evidence-graph @var-ia/analyzers
```

```ts
import type { EvidenceEvent, Revision } from "@var-ia/evidence-graph";
import { sectionDiffer, citationTracker } from "@var-ia/analyzers";
```

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| `@var-ia/evidence-graph` | [![npm](https://img.shields.io/npm/v/@var-ia/evidence-graph)](https://www.npmjs.com/package/@var-ia/evidence-graph) | Core types and schemas — claim, evidence, source, report |
| `@var-ia/ingestion` | [![npm](https://img.shields.io/npm/v/@var-ia/ingestion)](https://www.npmjs.com/package/@var-ia/ingestion) | Wikimedia API adapters — fetching, diffing, rate limits |
| `@var-ia/analyzers` | [![npm](https://img.shields.io/npm/v/@var-ia/analyzers)](https://www.npmjs.com/package/@var-ia/analyzers) | Deterministic analyzers — sections, citations, reverts, templates |
| `@var-ia/cli` | [![npm](https://img.shields.io/npm/v/@var-ia/cli)](https://www.npmjs.com/package/@var-ia/cli) | CLI tool — `wikihistory` command |
| `@var-ia/persistence` | — | Local SQLite persistence (bun:sqlite, not published) |
| `@var-ia/eval` | — | Evaluation harness (not published) |
| `@var-ia/observable` | — | Observable Framework data loader (not published) |

## How It Compares

Var-ia tracks **claim provenance** — structured evidence linking a claim's lifecycle
to specific revisions, sources, and policy signals. It complements existing tools:

| Tool | What it does | What var-ia adds |
|------|-------------|-----------------|
| **WikiWho** | Sentence-level authorship (who wrote which token) | Sentence lifecycle: when a sentence first appeared, was reworded, or removed |
| **ORES** | ML edit quality scores (likely damaging, good-faith) | Deterministic edit classification + policy-coded signals |
| **XTools** | Edit stats, page history summaries, top editors | Structured event stream: section changes, citation turnover, template diffs, page moves, category shifts |
| **PetScan** | Category intersection queries across pages | Category evolution per-page over time |

## Architecture

The engine follows a two-knowledge-split:

1. **Deterministic**: Wikipedia API ingestion, diff computation, section
   extraction, citation tracking, template classification, revert detection —
   byte-reproducible, no model involved.
2. **Outcome labels**: Independently sourced ground truth (talk page
   consensus, page protection events) — never redefined by the pipeline.

[Full architecture](./ARCHITECTURE.md)

## Private Instances

Var-ia connects to any MediaWiki instance — corporate wikis, institutional
knowledge bases, private fan wikis. Use the `--api` flag with the wiki's
`api.php` URL.

### Authentication

| Method | CLI flags | Description |
|--------|-----------|-------------|
| Bearer token | `--api-key <token>` | Sends `Authorization: Bearer <token>` with every request |
| Basic auth | `--api-user <user> --api-password <pass>` | Sends HTTP basic auth credentials |
| OAuth2 | `OAUTH_CLIENT_ID` + `OAUTH_CLIENT_SECRET` env vars | Sends `X-OAuth-Client-Id` and `X-OAuth-Client-Secret` headers |

All three methods work with every command:

```bash
# Bearer token
wikihistory analyze "Page" --api https://corp-wiki.example.com/w/api.php --api-key "sk-..."

# Basic auth
wikihistory analyze "Page" --api https://corp-wiki.example.com/w/api.php --api-user "admin" --api-password "..."

# OAuth2 (via env vars)
OAUTH_CLIENT_ID="..." OAUTH_CLIENT_SECRET="..." \
  wikihistory analyze "Page" --api https://corp-wiki.example.com/w/api.php
```

Credentials are never logged or exposed in error messages.

### Local Docker Testing

A Docker Compose setup is available for testing against a local MediaWiki
instance with auth:

```bash
cd docker
docker compose up -d
DOCKER_TESTS=true bun run test
```

This starts MediaWiki at `http://localhost:8080` and an nginx proxy with basic
auth at `http://localhost:8081`. The auth integration tests validate bearer
token, basic auth, and OAuth2 paths.

## Beyond Wikipedia

Var-ia works on any public MediaWiki instance — Fandom.com, independent fan wikis,
private wikis. Wikipedia's editorial norms suppress the most interesting dynamics;
fandom wikis don't.

| Dynamic | What Var-ia captures |
|---------|-------------------|
| **Canon disputes** | `category_removed`: `Canon characters` → `category_added`: `Legends characters` after the 2014 Disney acquisition |
| **Headcanon drift** | "Vader turned because of fear of loss" vs "pride and ambition" — reversibly edited, both cite the same films |
| **Warring wikis** | Cross-wiki diff detects a Game of Thrones Fandom wiki fork vs parallel evolution on an independent ASOIAF wiki |
| **Decade-spanning consensus** | 2008 talk page consensus about what's canon, overturned in 2023 — L3 outcome labels with temporal validity windows |

If the engine handles fandom, it handles anything.

## What It Is Not

| Category | Why |
|----------|-----|
| Truth detector | Reports what changed, not whether the change is accurate |
| Model interpreter | No LLM in the pipeline — interpretation lives downstream in consumers |
| Editor quality judge | No scoring, ranking, or profiling of individual editors |
| Prediction engine | No forecasting, no sentiment analysis, no trend extrapolation |
| Live monitor | Polling-based, not real-time — use `cron` mode for scheduled observation |
| Healthcare scorer | Domain-agnostic by design — no clinical, regulatory, or payer logic |

## License

AGPL-3.0. See [LICENSE](./LICENSE).

If you modify this software and deploy it as a network service, you must release
your modifications.

**Commercial use:** NextConsensus offers commercial licenses for proprietary
integration without AGPL obligations. See [nextconsensus.com](https://nextconsensus.com).

## Community

- [Contributing](./CONTRIBUTING.md) — how to get started
- [Good first tasks](./ROADMAP.md) — ready-to-pick-up work items
- [Discussions](https://github.com/var-ia/var-ia/discussions) — questions, ideas
- [Code of Conduct](./.github/CODE_OF_CONDUCT.md)
- [Security](./.github/SECURITY.md)
- [Changelog](./CHANGELOG.md)
- [Cite this software](./CITATION.cff)

## Ecosystem

These repos extend the core engine:

| Repo | Purpose |
|------|---------|
| [varia-docs](https://github.com/var-ia/varia-docs) | Public documentation site (quickstart, CLI, SDK, tutorials) |
| [varia-labs](https://github.com/var-ia/varia-labs) | Experimental probes applying the engine to adjacent verticals |
| [varia-ui](https://github.com/var-ia/varia-ui) | Standalone visualization — load JSONL, render timelines, diffs, citations |
| [varia-demo-data](https://github.com/var-ia/varia-demo-data) | Safe, fictional datasets for the eval harness (no real PII or medical data) |
