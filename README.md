# Wikipedia Provenance Engine

**Show what changed. Not what is true.**

A deterministic claim-provenance engine for Wikipedia page histories. This tool reconstructs how claims moved through Wikipedia's editorial system — when they appeared, how they changed, what sources supported them, and what policy signals surrounded each change. It does not determine truth, judge editors, or predict outcomes.

## What It Does

Given a Wikipedia page URL, the engine produces a structured evidence graph:

- **Timeline** — every revision, what changed, in which section
- **Claim lineage** — when a specific sentence first appeared, how it was reworded, when it was removed
- **Source lineage** — which citations appeared, were replaced, or survived
- **Policy signals** — verifiability, neutrality, BLP, due-weight templates and edit patterns
- **Interpretation** — bounded, confidence-labeled model readings: direct accusation → attributed finding, lead prominence → body placement

Every interpretation is tagged with its evidence layer:

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
- ❌ A Wikipedia monitoring dashboard

## Quick Start

```bash
# Install
npm install -g wikipedia-provenance

# Analyze a page
wikihistory analyze "COVID-19 pandemic" --depth detailed

# Track a specific claim
wikihistory claim "Theranos" --text "revolutionary blood testing"

# Export results
wikihistory export "CRISPR gene editing" --format json

# Watch a page section
wikihistory watch "FTX" --section "Controversy"
```

## Architecture

The engine follows a three-knowledge-split architecture:

1. **Deterministic** (L1): Wikipedia API ingestion, diff computation, section extraction, citation counting, revert detection — byte-reproducible, no model involved.
2. **Model-assisted** (L2): Semantic change classification, tone shift labeling, policy-dimension tagging — bounded interpretations with confidence scores.
3. **Outcome labels** (L3): Independently sourced ground truth (talk page consensus, page protection events) — never redefined by the pipeline.

## License

AGPL-3.0. See [LICENSE](./LICENSE).

If you modify this software and deploy it as a network service, you must release your modifications.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). All measurement claims must carry phase tags. Unsure of a claim's phase → Phase 0.
