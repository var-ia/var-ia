# Architecture: Three-Knowledge-Split

Varia separates computation into three architecturally isolated layers. No layer's output feeds into another layer's input in a way that would contaminate evidence with interpretation.

## Layer 1 (L1): Deterministic

**Answers**: What changed, when, where, how — byte-for-byte reproducible.

**Implementation**: Wikipedia API fetch, diff computation, section extraction, citation counting, revert detection, template tracking, pagination. No model involved. Every run on the same revision range produces identical output.

**Output**: Evidence objects with `deterministicFacts` arrays.

**Packages**: `@var-ia/ingestion` (fetch), `@var-ia/analyzers` (extract)

## Layer 2 (L2): Model-Assisted Interpretation

**Answers**: What kind of change is this semantically? What policy dimension? With what confidence?

**Implementation**: Pluggable model adapter (OpenAI, Anthropic, DeepSeek, local, BYOK). Receives only deterministic evidence from L1. Never receives raw wikitext — always pre-extracted facts with section, citation, and revert context.

**Output**: Evidence objects with `modelInterpretation` fields, each carrying a `confidence` score (0.0–1.0).

**Package**: `@var-ia/interpreter`

## Layer 3 (L3): Independent Ground Truth

**Answers**: Did real-world editorial processes validate the signal?

**Implementation**: Independently sourced ground truth — talk page consensus, page protection events, RFC closures, Arbitration Committee decisions. Never redefined by L1 or L2. Stored separately from pipeline output.

**Output**: Outcome labels with public observability timestamps and source references.

**Package**: `@var-ia/eval` (internal, not published)

## Data Flow

```
Wikipedia API → L1: Fetch + Extract → evidence objects
                                         ↓
                                    L2: Model Interpret → enriched evidence
                                         ↓
                                    Report Assembly → layered output
                                         ↓
                                    L3: Validate → ground truth comparison
```

## Invariants

1. L1 never calls a model
2. L2 never receives full revision wikitext — only L1-curated evidence snippets pre-extracted by deterministic analyzers
3. L3 is never redefined by L1 or L2 output
4. No single accuracy score conflates layers
5. Every interpretation carries a confidence score
6. Deterministic facts are always presented before interpretations

## Report Layers

Every user-facing output carries layer provenance:

| Label | Source | Reproducible? |
|-------|--------|---------------|
| **Observed** | L1 deterministic | Yes, byte-for-byte |
| **Policy-coded** | L1 + Wikipedia policy ontology | Yes, rules-based |
| **Model interpretation** | L2 LLM | No, bounded by confidence |
| **Speculative** | L2 low-confidence (<0.5) | No, flagged as uncertain |
| **Unknown** | Insufficient evidence | N/A |

## Phase Discipline

All measurement claims carry a phase tag:

| Phase | Allowed |
|-------|---------|
| Phase 0 | Internal exploration only (no production claims) |
| Phase 1b | Cross-lane transferability — claim transfers across contexts |
| Phase 2a | n=1 values with caveat — validated on one case only |
| Phase 2b | Full validated claims — holdout > 0, multiple backtests |

When unsure of a claim's phase → Phase 0.
