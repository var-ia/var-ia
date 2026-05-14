# @var-ia/evidence-graph

Core types and schemas. Zero runtime dependencies.

```bash
bun add @var-ia/evidence-graph
```

## Exports

### Types

- `ClaimIdentity`, `ClaimLineage`, `ClaimState`, `ClaimObject` — claim tracing
- `EvidenceEvent`, `DeterministicFact`, `ModelInterpretation`, `EvidenceLayer` — event model
- `SourceRecord`, `SourceLineage`, `SourceReplacement`, `SourceType`, `SourceAuthority` — citation tracking
- `Report`, `ReportLayer`, `ReportLayerLabel`, `ExportFormat`, `Depth`, `PageTimeline`, `TimelineEvent`, `PolicySignal` — report assembly
- `Revision`, `DiffResult`, `DiffLine`, `Section`, `SectionChange` — revision model

### Functions

- `createClaimIdentity(pageTitle, claimText)` — deterministic hash for claim dedup
- `createEventIdentity(pageTitle, eventType, revisionRange)` — deterministic event fingerprint

```ts
import type { EvidenceEvent, Revision } from "@var-ia/evidence-graph";
import { createClaimIdentity } from "@var-ia/evidence-graph";
```
