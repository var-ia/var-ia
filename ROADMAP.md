# Roadmap

Varia is at 0.1.0. This roadmap tracks the next increment of awareness mechanisms
surfaced by the fandom historian use case. Every item extends the existing
three-layer architecture without restructuring it.

## Why Fandom?

Fan wikis are adversarial knowledge environments that surface edge cases Wikipedia's
editorial norms prevent. Four dynamics make fandom the testing ground for Varia's
capabilities:

**Canon disputes.** Multiple official canons coexist — Star Wars Legends vs.
Disney canon, DC Rebirth vs. New 52. Edits don't just change facts; they change
which reality a page describes. A "retcon" (retroactive continuity change) makes
text that was true last month false because the IP owner released new material.
Detecting _which_ canon an edit aligns with requires tracking claims across
revisions (L1-06) and correlating with talk page discussions about sourcing
(L1-02, L2-01).

**Warring wikis.** The same fandom topic often has competing wikis — a Game of
Thrones wiki on Fandom.com vs. an independent Song of Ice and Fire wiki. Editors
split and fork. The same page diverges under different editorial standards. A
cross-wiki diff (CW-01) reveals when and how divergence happened — a fork event
vs. parallel independent development.

**Headcanon drift.** Fan wikis have weaker sourcing norms. A contributor's
personal interpretation ("headcanon") seeps into article text. Another editor
reverts it citing no source. But "source" itself is contested: Is an author
tweet canon? A deleted Tumblr post? A DVD deleted scene? The revert detector
fires, but the talk page (L1-01, L1-02) reveals the dispute is about what
constitutes a source, not mere vandalism.

**Doctrinal edit wars.** Wikipedia edit wars are usually about factuality. Fan
wiki edit wars are about interpretation. "Darth Vader turned because of fear of
loss" vs. "...because of pride and ambition" — both supported by the same films,
both contradictory. The revision history shows back-and-forth edits; the talk
page reveals it's a theological dispute about character interpretation. This is
what talk page correlation (L1-02) surfaces, and what L2 interpretation
(L2-01) classifies with confidence scores.

**Time-deep and sectarian.** Some fandom wikis span 15+ years with tens of
thousands of edits. Talk page archives span a decade. A 2008 consensus about
what's "canon" gets overturned in 2023 because a prequel novel overwrites
existing material. L3 evaluation (INFRA-01) must handle temporally-valid outcome
labels — an outcome from 2015 was correct then but is incomplete now. Sub-pages
factionalize: the "Jedi" page has one editorial group, the "Sith" page has
another. Category tracking (L1-05) surfaces how the factional structure maps to
the page topology.

## Status

| ID | Item | Layer | Priority | Effort | Deps | Status |
|----|------|-------|----------|--------|------|--------|
| L1-01 | Talk page fetcher | L1 | 1 | small | — | done |
| L1-02 | Talk page correlation | L1 | 1 | small | L1-01 | ready |
| L1-03 | Wikilink extractor | L1 | 2 | small | — | done |
| L1-04 | Page move detector | L1 | 3 | small | — | done |
| L1-05 | Category tracker | L1 | 4 | small | — | done |
| L1-06 | Claim direction classification | L1 | 5 | medium | — | done |
| L2-01 | Talk page interpretation | L2 | 6 | medium | L1-01, L1-02 | blocked |
| L2-02 | Lineage-aware interpretation | L2 | 7 | medium | — | done |
| CW-01 | Cross-wiki diff command | CLI | 8 | medium | — | done |
| INFRA-01 | Real L3 eval with ground truth | INFRA | 9 | large | L1-01, L1-02 | blocked |

## Dependency Graph

```
L1-01 ──→ L1-02 ──→ L2-01
                    L2-01 ──→ INFRA-01
                    L1-02 ──→ INFRA-01
L1-03 (independent)
L1-04 (independent)
L1-05 (independent)
L1-06 (independent)
L2-02 (independent)
CW-01 (independent)
```

**Ready now (no blocking dependencies):** L1-02

## L1 — Deterministic

### L1-01: Talk Page Fetcher
Add `fetchTalkRevisions()` to `MediaWikiClient`. Talk pages use the `Talk:` namespace prefix and expose the same `action=query&prop=revisions` API as article pages. This is the prerequisite for L3 ground truth — talk pages contain editorial reasoning, consensus discussions, and dispute resolutions.

### L1-02: Talk Page Correlation
Match talk page revisions to article revisions by timestamp proximity windows. Produces `talk_page_correlated` events (event type already reserved in `packages/evidence-graph/src/schemas/evidence.ts:24`). Matched strictly on timestamp — no NLP, fully L1.

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

## Infrastructure

### INFRA-01: Real L3 Eval
The current eval harness (`packages/eval/src/index.ts`) only checks event-type detection accuracy against expected types. Real L3 means independently sourced ground truth: talk page consensus labels, RFC outcomes, ArbCom decisions. Depends on L1-01 and L1-02 for talk page data.

## Conventions

- Each task has a detailed prompt in `.github/workqueue/{ID}.md`
- `ready` = all dependencies satisfied, can be picked up
- `blocked` = waiting on dependencies
- Update the status column and dependency graph in this file when a task completes
- After completing a task, run the gate: `bun run build && bun run lint && bun run typecheck && bun run test`
