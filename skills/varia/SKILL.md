---
name: varia
description: Use when integrating MediaWiki edit history analysis, building claim-provenance tools, or working with @var-ia/* packages — deterministic L1 observation engine with three-layer architecture
license: AGPL-3.0
---

# Var-ia

Deterministic claim-provenance engine for MediaWiki knowledge systems. Evidence, not truth.

## When to Use

- Integrating MediaWiki edit history analysis into a tool
- Building claim-provenance tracking across revisions
- Using `@var-ia/*` packages (evidence-graph, analyzers, ingestion, interpreter)
- Running the `wikihistory` CLI for page analysis
- Extending the engine with new analyzers or model adapters
- Setting up L2 model-assisted interpretation on top of L1 deterministic evidence

## Quick Start

```bash
# CLI via npx (coming) or clone the repo
git clone https://github.com/nextconsensus/varia
cd varia && bun install && bun run build

# Analyze a Wikipedia page
bun packages/cli/src/index.ts analyze "Earth" --depth detailed

# Track a specific claim across revisions
bun packages/cli/src/index.ts claim "Earth" --text "Earth is the third planet from the Sun"

# Watch a page section
bun packages/cli/src/index.ts watch "Climate_change" --section "Scientific consensus"
```

### Using Packages

```ts
import type { EvidenceEvent, ClaimIdentity } from "@var-ia/evidence-graph";
import { createClaimIdentity } from "@var-ia/evidence-graph";
import { MediaWikiClient } from "@var-ia/ingestion";
import { sectionDiffer, citationTracker } from "@var-ia/analyzers";
import { createAdapter } from "@var-ia/interpreter";

// L1: Fetch revisions (deterministic, no model)
const client = new MediaWikiClient();
const revisions = await client.fetchRevisions("Earth", { limit: 50 });

// L1: Extract evidence (deterministic, no model)
const sections = sectionDiffer.extractSections(revisions[0].content);
const citations = citationTracker.extractCitations(revisions[0].content);

// L2: Model-assisted interpretation (receives only L1 evidence)
const adapter = createAdapter({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
});
const interpreted = await adapter.interpret(evidenceEvents);
```

## Architecture: Three-Knowledge-Split (Critical)

Every integration MUST respect these invariants:

| Layer | Scope | Can call model? | Sees raw text? | Output |
|-------|-------|-----------------|----------------|--------|
| **L1** | Deterministic extraction | Never | Yes (wikitext) | `deterministicFacts` arrays |
| **L2** | Model-assisted interpretation | Yes | Never — only L1 evidence | `modelInterpretation` with `confidence` |
| **L3** | Independent ground truth | N/A | N/A | Outcome labels (talk page consensus, RFCs, ArbCom) |

**Invariants (do not violate):**
1. L1 never calls a model
2. L2 never sees raw Wikipedia text — only pre-extracted deterministic facts
3. L3 is never redefined by L1 or L2 output
4. No single accuracy score conflates layers
5. Every interpretation carries a confidence score (0.0–1.0)
6. Deterministic facts always presented before interpretations

## Packages

| Package | npm | Purpose | Layer |
|---------|-----|---------|-------|
| `evidence-graph` | `@var-ia/evidence-graph` | Core types/schemas (no deps) | Shared |
| `ingestion` | `@var-ia/ingestion` | Wikipedia API adapters, rate limiting | L1 |
| `analyzers` | `@var-ia/analyzers` | Section diffing, citation tracking, revert detection, template tracking | L1 |
| `interpreter` | `@var-ia/interpreter` | Pluggable model adapter (OpenAI, Anthropic, DeepSeek, local, BYOK) | L2 |
| `cli` | `@var-ia/cli` | `wikihistory` CLI tool | L1+L2 |
| `persistence` | (internal) | SQLite caching (bun:sqlite) | Shared |
| `eval` | (internal) | Evaluation harness with benchmark pages | L3 |

### Import Conventions

```ts
// Cross-package types
import type { EvidenceEvent, ClaimIdentity } from "@var-ia/evidence-graph";

// Cross-package runtime
import { MediaWikiClient } from "@var-ia/ingestion";
import { sectionDiffer } from "@var-ia/analyzers";

// Intra-package (relative with .js extension)
import { createAdapter } from "./adapter.js";
```

Always use `import type` for type-only imports. Never import from `dist/`.

## Core Types

### EvidenceEvent
The central unit — what happened at a revision boundary.

```ts
interface EvidenceEvent {
  eventType: EventType;         // "claim_first_seen" | "citation_added" | "revert_detected" | ...
  claimId?: string;
  fromRevisionId: number;
  toRevisionId: number;
  section: string;
  before: string;
  after: string;
  deterministicFacts: DeterministicFact[];
  modelInterpretation?: ModelInterpretation;  // Added by L2
  layer: EvidenceLayer;         // "observed" | "policy_coded" | "model_interpretation" | ...
  timestamp: string;            // ISO 8601
}
```

### ClaimObject
Tracks a proposition across revision history.

```ts
interface ClaimObject {
  identity: ClaimIdentity;
  lineage: ClaimLineage;
  currentState: ClaimState;     // "absent" → "emerging" → "contested" → ... → "deleted"
  propositionType: PropositionType;
  phase: string;                // Phase 0 | Phase 1b | Phase 2a | Phase 2b
}
```

### ModelAdapter (L2)
The pluggable interpretation interface.

```ts
interface ModelAdapter {
  interpret(events: EvidenceEvent[]): Promise<InterpretedEvent[]>;
}

interface ModelConfig {
  provider: "openai" | "anthropic" | "deepseek" | "local" | "byok";
  apiKey?: string;
  model?: string;
  endpoint?: string;
}
```

### CLI Commands

```
wikihistory analyze <page>  [--depth brief|detailed|forensic] [--from <rev>] [--to <rev>] [--cache]
wikihistory claim <page>    --text "<claim>"
wikihistory export <page>   --format json|csv
wikihistory watch <page>    [--section <name>]
```

## Reference Files

| Task | File |
|------|------|
| Architecture invariants, data flow | [references/architecture.md](references/architecture.md) |
| Core types (EvidenceEvent, ClaimObject, Report) | [references/types.md](references/types.md) |
| CLI commands and options | [references/cli.md](references/cli.md) |
| Eval harness and benchmark pages | [references/eval.md](references/eval.md) |

## Forbidden Features

When building on top of varia, do NOT create features that:

- Target or identify individual editors
- Do sentiment analysis or toxicity scoring
- Predict or forecast future edits
- Automate Wikipedia editing
- Make truth/accuracy claims about content
- Use healthcare-specific vocabulary (drug names, FDA, clinical trials)

## Cross-Skill References

- **Model routing** → Use `model-router` skill for multi-provider L2 configuration
- **SQLite persistence** → `persistence` package uses bun:sqlite
- **Testing** → Use `vitest` skill (vitest with `globals: true`, tests in `src/__tests__/*.test.ts`)
