# Examples

Each script is a self-contained `bun` executable. Run any of them:

```bash
bun run examples/01-claim-provenance.ts
bun run examples/02-equivalent-to-wikiwho.ts
# ...etc
```

## Index

| # | Script | Problem It Solves |
|---|--------|-------------------|
| 01 | [claim-provenance.ts](01-claim-provenance.ts) | Track a specific claim across revision history — first appearance, rewording, removal |
| 02 | [equivalent-to-wikiwho.ts](02-equivalent-to-wikiwho.ts) | Token attribution vs. structured evidence with citation + template context |
| 03 | [equivalent-to-ores.ts](03-equivalent-to-ores.ts) | Black-box ML scores vs. deterministic, reproducible edit classification with provenance |
| 04 | [from-scratch-to-varia.ts](04-from-scratch-to-varia.ts) | The ~800 lines of brittle Wikipedia analysis code you don't need to write |
| 05 | [wikidata-editorial-depth.ts](05-wikidata-editorial-depth.ts) | Current claim state vs. full editorial history — sources tried, replaced, removed |
| 06 | [custom-model-adapter.ts](06-custom-model-adapter.ts) | L2 adapter deep dive — pipeline, lineage context, adapters, consensus, custom adapter |

## Audience

Each script targets a specific migration audience:

- **WikiWho users** (02): "You get structured events + citation/template context instead of raw token diffs."
- **ORES consumers** (03): "Same classifications, byte-reproducible, with a 'why' for every label."
- **Manual API scraper rebuilders** (04): "Your pipeline already exists — in 3 imports."
- **Wikidata-oriented researchers** (05): "Edit history of claims, not just current state."
- **Model adapter builders** (06): "The hardest API to learn from types alone, walked through step by step."

Scripts 01-05 are fully deterministic — no API keys needed. Script 06
requires a model provider key to show live interpretation (but documents
the setup flow even without one).

Each script runs against live Wikipedia API with a rate limiter
(200ms minimum delay between requests). They use small revision
windows (8-20 revisions) for quick runs.
