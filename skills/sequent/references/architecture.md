# Architecture

Sequent separates computation into two layers. No layer's output contaminates another.

## Layer 1: Deterministic

**Answers**: What changed, when, where, how — byte-for-byte reproducible.

**Implementation**: Wikipedia API fetch, diff computation, section extraction, citation counting, revert detection, template tracking, pagination. No model involved. Every run on the same revision range produces identical output.

**Output**: Evidence objects with `deterministicFacts` arrays.

**Packages**: `@var-ia/ingestion` (fetch), `@var-ia/analyzers` (extract)

## Layer 2: Ground Truth

**Answers**: Did real-world editorial processes validate the signal?

**Implementation**: Independently sourced ground truth — talk page consensus, page protection events, RFC closures, Arbitration Committee decisions. Never redefined by pipeline output. Stored separately.

**Output**: Outcome labels with public observability timestamps and source references.

**Package**: `@var-ia/eval` (eval harness)

## Data Flow

```
Wikipedia API
     │
     ▼
┌─────────────┐
│  Fetch       │ ← Deterministic
│  + Extract   │
└──────┬──────┘
       │ evidence events
       ▼
┌─────────────┐
│  Analyze     │ ← Deterministic: diffs, citations, reverts, templates
└──────┬──────┘
       │ enriched events
       ▼
┌─────────────┐
│  Report      │ ← Assemble layered output
└──────┬──────┘
       │ report
       ▼
┌─────────────┐
│  Validate    │ ← Compare against ground truth (eval)
└─────────────┘
```

## Invariants

1. Deterministic pipeline never calls a model
2. Every event is provenance-tagged (revision, section, timestamp)
3. Output is byte-for-byte reproducible on the same revision range
4. Ground truth is never redefined by pipeline output

## Downstream consumption

Domain-specific interpretation layers (e.g., NextConsensus) consume Sequent's event stream. They must:

- Never modify Sequent's event types or schemas
- Attribute provenance: "deterministic observation from Sequent" vs. their own interpretation
