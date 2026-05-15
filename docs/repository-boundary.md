# Repository Boundary

Sequent is open-source core observability for MediaWiki and public revision histories.
Sequent observes change. Healthcare-specific logic lives in private repos.

## In Scope

- Fetching and replaying MediaWiki revision histories.
- Deterministic extraction of what changed between revisions.
- Provenance records for claims, sources, page structure, links, categories,
  templates, talk-page references, and page moves.
- Optional model-assisted interpretation that receives only extracted evidence
  and emits bounded labels with confidence.
- Generic benchmarks that check whether Sequent detected publicly observable
  revision-history events.
- Connectors for public or user-controlled MediaWiki instances.

## Out of Scope

- Healthcare-specific logic (decision judgment, source weighting, clinical rules, customer workflows).
- Claims that Sequent determines truth, predicts external events, or ranks people.

## Test

A valid Sequent contribution should be useful for observing public-knowledge change
on Wikipedia, Fandom, or another MediaWiki instance without relying on healthcare
context or private decision criteria.
