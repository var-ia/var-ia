# Roadmap

Varia v0.1 (Phase 1) is complete. All 20 workqueue items shipped.

## Agent Workstream Mapping

The monorepo packages have been reorganized to match the agent workstream structure:

| Package | Workstream | Purpose |
|---------|-----------|---------|
| `evidence-graph` | Agent F | Event schema and export |
| `ingestion` | Agent A | MediaWiki ingestion |
| `analyzers` | Agents B/C/D/E | Diff engine, claims, citations, disputes |
| `interpreter` | L2 model adapter | — |
| `cli` | Agent G | CLI and local storage |
| `persistence` | Agent G | Local storage |
| `eval` | — | Evaluation harness (generic, kept in varia) |
| `observable` | — | Observable Framework data loaders |

## What Varia Observes

Varia is a generic MediaWiki observation engine. The `--api` flag accepts any
`api.php` endpoint — Wikipedia, Fandom.com wikis, independent fan wikis, any
public MediaWiki instance. Revision history, diffs, talk pages, page moves,
categories, wikilinks — all extracted deterministically from the API response,
byte-for-byte reproducible.

Fandom wikis are the hardest public-domain stress test for the architecture:

**Canon disputes.** Multiple official canons coexist — Star Wars Legends vs.
Disney canon, DC Rebirth vs. New 52. Edits change which reality a page describes.
Tracking claims across revisions (L1-06) and correlating with talk page
discussions about sourcing (L1-02, L2-01) reveals which canon an edit aligns with.

**Warring wikis.** The same topic has competing wikis — a Game of Thrones wiki
on Fandom.com vs. an independent Song of Ice and Fire wiki. Editors split and
fork. Cross-wiki diff (CW-01) distinguishes a fork event from parallel
independent development.

**Headcanon drift.** A contributor's personal interpretation seeps into article
text. Another editor reverts it citing no source. But "source" itself is
contested: is an author tweet canon? The revert detector fires, but the talk
page (L1-01, L1-02) reveals the dispute is about what constitutes a source.

**Doctrinal edit wars.** "Darth Vader turned because of fear of loss" vs.
"...because of pride and ambition" — both supported by the same films, both
contradictory. The revision history shows back-and-forth edits; the talk page
reveals it's a dispute about character interpretation. Talk page correlation
(L1-02) surfaces the pattern; L2 (L2-01) classifies the discussion type.

**Time-deep.** 15+ year revision histories, decade-spanning talk page archives.
A 2008 consensus about what's canon gets overturned in 2023. L3 outcome labels
(INFRA-01) must carry temporal validity windows — a label that was correct in
2015 may be incomplete today. Sub-pages factionalize: category tracking (L1-05)
surfaces how the editorial-group structure maps to the page topology.

Wikipedia's editorial norms suppress most of these dynamics. Fandom wikis don't.
That makes them the proving ground — if the engine handles fandom, it handles
anything.

## Status

**Phase 1 (Varia v0.1): Complete.**

All 20 workqueue items are shipped. See the task descriptions below for details on what was built.

**Phase 2: Ongoing.** This repo is in maintenance mode for bug fixes and polish.

## L1 — Deterministic

### L1-01: Talk Page Fetcher
Add `fetchTalkRevisions()` to `MediaWikiClient`. Talk pages use the `Talk:` namespace prefix and expose the same `action=query&prop=revisions` API as article pages. This is the prerequisite for L3 ground truth — talk pages contain editorial reasoning, consensus discussions, and dispute resolutions.

### L1-02: Talk Page Correlation
Match talk page revisions to article revisions by timestamp proximity windows. Produces `talk_page_correlated` events (event type already reserved in `packages/evidence-graph/src/schemas/evidence.ts:27`). Matched strictly on timestamp — no NLP, fully L1.

### L1-03: Wikilink Extractor
Extract `[[internal links]]` from wikitext, diff across revisions. Produces `wikilink_added` and `wikilink_removed` events (new event types). Reveals how an article's link neighborhood evolves over time — deterministic alternative to sentiment analysis for detecting editorial shifts.

### L1-04: Page Move Detector
Query `action=query&list=logevents&letype=move` to detect page renames. Produces `page_moved` events (event type reserved in `packages/evidence-graph/src/schemas/evidence.ts:22`).

### L1-05: Category Tracker
Extract `[[Category:...]]` from wikitext, diff across revisions. Produces `category_added` and `category_removed` events (new event types). Tracks how editorial categorization of a topic changes over time.

### L1-06: Claim Direction Classification
Extend the existing claim differ to classify claim changes as `claim_softened`, `claim_strengthened`, or `claim_moved` (event types reserved in `packages/evidence-graph/src/schemas/evidence.ts:8-11`). Current claim tracking only emits `claim_first_seen`, `claim_removed`, `claim_reworded`, `claim_reintroduced`.

## L2 — Model-Assisted

### L2-01: Talk Page Interpretation
Once L1 produces `talk_page_correlated` events, L2 can classify discussion types (notability challenge, sourcing dispute, neutrality concern, deletion proposal) with confidence scores. Model never sees raw talk page text — only L1-extracted facts.

### L2-02: Lineage-Aware Interpretation
Current L2 sees isolated event pairs. Pass the full section/source/claim lineage so the model can detect multi-revision patterns ("gradually softened over 5 revisions" vs "removed and reintroduced unchanged"). Requires extending the interpreter prompt to accept lineage context.

## Cross-Wiki

### CW-01: Cross-Wiki Diff
New CLI command: `wikihistory diff --wiki-a <url> --wiki-b <url> <topic>`. Runs the full analyze pipeline against two MediaWiki instances independently, then diffs the structured evidence output. Deterministic at L1; optional L2 interpretation on each side independently.

### CW-04: Non-English Wikipedia Support
Test and document the engine against non-English Wikipedias (de.wikipedia.org, fr.wikipedia.org, ja.wikipedia.org, etc.). The `--api` flag already accepts any MediaWiki endpoint, so the architecture supports this. This task is about verification: run the full analyze pipeline against non-English pages, document any parser edge cases (RTL languages, non-ASCII section headers, CJK citation formats), and add integration tests. No architecture changes expected — just hardening.

### CW-05: Private MediaWiki Instance Support
Test and document the engine against self-hosted/private MediaWiki instances (corporate wikis, institutional knowledge bases, private fan wikis). Builds on `--api` flag. Requires: authentication support (OAuth, basic auth, API tokens) via config, documentation for connecting to non-public instances, and integration tests against a local MediaWiki container. This remains generic MediaWiki observability: authenticated access should not add domain-specific judgment, source weighting, or private workflow logic.

## Infrastructure

### INFRA-01: Real L3 Eval
The current eval harness (`packages/eval/src/index.ts`) only checks event-type detection accuracy against expected types. Real L3 means independently sourced ground truth: talk page consensus labels, RFC outcomes, ArbCom decisions. Depends on L1-01 and L1-02 for talk page data.

## Conventions

- Each task has a detailed prompt in `.github/workqueue/{ID}.md`
- `ready` = all dependencies satisfied, can be picked up
- `blocked` = waiting on dependencies
- Update the status column and dependency graph in this file when a task completes
- After completing a task, run the gate: `bun run build && bun run lint && bun run typecheck && bun run test`
