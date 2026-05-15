# @var-ia/analyzers

Deterministic analyzers. Byte-for-byte reproducible, no model involved.

```bash
bun add @var-ia/analyzers
```

## Exports

### Analyzers

- `sectionDiffer` — section extraction and diffing between revisions
- `citationTracker` — citation extraction, diffing, and source lineage
- `revertDetector` — revert comment matching and revert chain detection
- `templateTracker` — template extraction and diffing (citation, neutrality, BLP, etc.)
- `classifyHeuristic` — heuristic edit classification (revert, vandalism, sourcing, cosmetic, minor)

### Utilities

- `sanitizeWikitext`, `extractHeadingMap`, `deriveSectionHeading`, `countCitations`, `countKeywordMentions`, `extractAnchorSnippet` — wikitext parsing helpers

### Builders

- `buildSectionLineage` — full section ancestry chain across revisions
- `buildSourceLineage`, `buildSourceId` — citation ancestry

### Types

- `SectionDiffer`, `CitationTracker`, `RevertDetector`, `TemplateTracker` — analyzer interfaces
- `CitationRef`, `CitationChange`, `RevertChain`, `Template`, `TemplateChange`, `TemplateType` — domain types
- `HeuristicKind`, `SectionEvent`, `SectionLineage`, `HeadingPosition` — supporting types

```ts
import { sectionDiffer, citationTracker, revertDetector } from "@var-ia/analyzers";
```

[Refract](https://github.com/var-ia/sequent) · [Docs](https://github.com/var-ia/sequent-docs) · [npm](https://www.npmjs.com/package/@var-ia/analyzers)
