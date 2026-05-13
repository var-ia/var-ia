# Architecture: Three-Knowledge-Split Design

The Wikipedia Provenance Engine separates computation into three architecturally isolated layers. No layer's output feeds into another layer's input in a way that would contaminate evidence with interpretation.

## Layer 1 (L1): Deterministic

**What it answers**: What changed, when, where, how — byte-for-byte reproducible.

**Implementation**: Wikipedia API fetch, diff computation, section extraction, citation counting, revert detection, template tracking, pagination. No model involved. Every run on the same revision range produces identical output.

**Output**: Evidence objects with `deterministic_facts` arrays.

## Layer 2 (L2): Model-Assisted Interpretation

**What it answers**: What kind of change is this semantically? What policy dimension does it touch? With what confidence?

**Implementation**: Pluggable model adapter (default: hosted LLM, supports BYOK and local). Receives only deterministic evidence from L1. Never receives raw text — always pre-extracted facts with section, citation, and revert context.

**Output**: Evidence objects with `model_interpretation` fields, each carrying a `confidence` score (0.0–1.0).

## Layer 3 (L3): Independent Ground Truth

**What it answers**: Did real-world editorial processes validate the signal?

**Implementation**: Independently sourced ground truth — talk page consensus, page protection events, RFC closures, Arbitration Committee decisions. Never redefined by L1 or L2. Stored separately from pipeline output.

**Output**: Outcome labels with public observability timestamps and source references.

![Architecture Data Flow](./docs/diagrams/architecture-flow.svg)

## Data Flow (Text)

```
Wikipedia API
     │
     ▼
┌─────────────┐
│  L1: Fetch   │ ← Deterministic: revisions, diffs, sections, citations
│  + Extract   │
└──────┬──────┘
       │ evidence objects
       ▼
┌─────────────┐
│  L2: Model   │ ← Model-assisted: semantic change, policy labels, confidence
│  Interpret   │
└──────┬──────┘
       │ enriched evidence objects
       ▼
┌─────────────┐
│  Report      │ ← Assembles L1 facts + L2 interpretations into layered output
│  Assembly    │
└──────┬──────┘
       │ report
       ▼
┌─────────────┐
│  L3: Validate│ ← Independent: compares report against ground truth labels
│  + Measure   │
└─────────────┘
```

## Report Layers

Every user-facing output carries layer provenance:

| Label | Source | Reproducible? |
|-------|--------|---------------|
| **Observed** | L1 deterministic | Yes, byte-for-byte |
| **Policy-coded** | L1 + Wikipedia policy ontology | Yes, rules-based |
| **Model interpretation** | L2 LLM | No, bounded by confidence |
| **Speculative** | L2 low-confidence (<0.5) | No, flagged as uncertain |
| **Unknown** | Insufficient evidence | N/A |

## Model Adapter Contract

The L2 adapter must implement:

```typescript
interface ModelAdapter {
  interpret(evidence: EvidenceEvent[]): Promise<InterpretedEvent[]>;
  confidence(interpretation: ModelInterpretation): number;
}
```

Default adapter uses a hosted LLM. BYOK and local model endpoints are supported via the same interface.

## Invariants

1. L1 never calls a model
2. L2 never sees raw Wikipedia text (only pre-extracted deterministic facts)
3. L3 is never redefined by L1 or L2 output
4. No single accuracy score conflates layers
5. Every interpretation carries a confidence score
6. Deterministic facts are always presented before interpretations
