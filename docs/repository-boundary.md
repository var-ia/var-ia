# Repository Boundary

Varia is open-source core observability for MediaWiki and public revision histories.

## Repo Map

| Category | Answers | Scope |
|----------|---------|-------|
| **Varia repos** (open-source) | "What changed?" | Generic public-knowledge observability |
| **NextConsensus repos** (private) | "Does this change matter for this healthcare decision?" | Healthcare-specific decision intelligence |
| **Private repos** (private) | — | Source weighting, thresholds, backtests, customer workflows, outcome data |

Varia observes change. NextConsensus judges healthcare decision relevance.

## In Scope (Varia repos)

- Fetching and replaying MediaWiki revision histories.
- Deterministic extraction of what changed between revisions.
- Provenance records for claims, sources, page structure, links, categories,
  templates, talk-page references, and page moves.
- Optional model-assisted interpretation that receives only extracted evidence
  and emits bounded labels with confidence.
- Generic benchmarks that check whether Varia detected publicly observable
  revision-history events.
- Connectors for public or user-controlled MediaWiki instances.

## Out of Scope (Varia repos)

- Healthcare decision judgment or recommendation logic.
- Payer, guideline, clinical, regulatory, customer, or case-workflow rules.
- Domain-specific source weighting.
- Decision thresholds, production backtests, outcome-data claims, or lead-time
  claims imported from a private product.
- Any NextConsensus-private logic, prompts, datasets, scoring rules, or
  customer workflows.
- Claims that Varia determines truth, predicts external events, or ranks people.

## Agent Rule

When in doubt, keep Varia generic. A valid Varia contribution should be useful
for observing public-knowledge change on Wikipedia, Fandom, or another MediaWiki
instance without relying on healthcare context or private decision criteria.
