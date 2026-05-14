# Core Types

## EvidenceEvent

The central output unit — describes what changed at a revision boundary.

```ts
type EvidenceLayer = "observed" | "policy_coded" | "model_interpretation" | "speculative" | "unknown";

type EventType =
  | "claim_first_seen" | "claim_removed" | "claim_softened" | "claim_strengthened"
  | "claim_reworded" | "claim_moved"
  | "citation_added" | "citation_removed" | "citation_replaced"
  | "template_added" | "template_removed"
  | "revert_detected"
  | "section_reorganized" | "lead_promotion" | "lead_demotion"
  | "page_moved" | "protection_changed" | "talk_page_correlated";

interface EvidenceEvent {
  eventType: EventType;
  claimId?: string;
  fromRevisionId: number;
  toRevisionId: number;
  section: string;
  before: string;
  after: string;
  deterministicFacts: DeterministicFact[];
  modelInterpretation?: ModelInterpretation;   // Added by L2
  layer: EvidenceLayer;
  timestamp: string;                             // ISO 8601
}

interface DeterministicFact {
  fact: string;     // e.g., "text_changed", "attribution_added", "same_section"
  detail?: string;
}

interface ModelInterpretation {
  semanticChange: string;    // e.g., "direct accusation changed to attributed institutional finding"
  confidence: number;        // 0.0–1.0
  policyDimension?: string;  // e.g., "verifiability", "npov", "blp", "due_weight"
}
```

## ClaimObject

Tracks a proposition across the revision timeline.

```ts
type PropositionType =
  | "factual_claim" | "attributed_claim" | "institutional_finding"
  | "allegation" | "counterclaim" | "policy_statement" | "editorial_note"
  | "unknown";

type ClaimState =
  | "absent" | "emerging" | "contested" | "softened" | "strengthened"
  | "stabilizing" | "hardened" | "receding" | "deleted" | "reintroduced";

interface ClaimIdentity {
  claimId: string;       // Deterministic hash from identity key
  identityKey: string;   // Canonical claim text + section + page
  pageTitle: string;
  pageId: number;
}

interface ClaimLineage {
  firstSeenRevisionId: number;
  firstSeenAt: string;
  lastSeenRevisionId?: number;
  lastSeenAt?: string;
  variants: ClaimVariant[];
  mergeSourceIds?: string[];
  splitTargetIds?: string[];
  deprecatedAt?: string;
  deprecatedByClaimId?: string;
}

interface ClaimObject {
  identity: ClaimIdentity;
  lineage: ClaimLineage;
  currentState: ClaimState;
  propositionType: PropositionType;
  sourceLineage: string[];
  phase: string;   // Phase 0 | Phase 1b | Phase 2a | Phase 2b
}
```

## Report

The assembled output with layer provenance.

```ts
type Depth = "brief" | "detailed" | "forensic";
type ExportFormat = "json" | "pdf" | "csv";

interface Report {
  pageTitle: string;
  pageId: number;
  analyzedRevisionRange: { from: number; to: number };
  generatedAt: string;
  depth: Depth;
  layers: ReportLayer[];
  timeline: PageTimeline;
  claims: string[];
  sources: string[];
  policySignals: PolicySignal[];
  caveats: string[];
  phase: string;
}

interface ReportLayer {
  label: ReportLayerLabel;
  description: string;
  events: number;
  reproducible: boolean;
}

interface PageTimeline {
  totalRevisions: number;
  analyzedRevisions: number;
  dateRange: { start: string; end: string };
  events: TimelineEvent[];
}

interface PolicySignal {
  dimension: string;          // e.g., "verifiability", "npov", "blp"
  signal: string;             // e.g., "citation_needed_template_added"
  firstSeenRevisionId: number;
  lastSeenRevisionId?: number;
  active: boolean;
}
```

## Analyzer Interfaces (L1)

```ts
interface SectionDiffer {
  extractSections(wikitext: string): Section[];
  diffSections(before: Section[], after: Section[]): SectionChange[];
}

interface CitationTracker {
  extractCitations(wikitext: string): CitationRef[];
  diffCitations(before: CitationRef[], after: CitationRef[]): CitationChange[];
}

interface RevertDetector {
  isRevert(comment: string): boolean;
  detectRevertChain(revisions: Revision[]): RevertChain[];
}

interface TemplateTracker {
  extractTemplates(wikitext: string): Template[];
  diffTemplates(before: Template[], after: Template[]): TemplateChange[];
}
```

## Model Adapter (L2)

```ts
interface ModelAdapter {
  interpret(events: EvidenceEvent[]): Promise<InterpretedEvent[]>;
}

interface InterpretedEvent extends EvidenceEvent {
  modelInterpretation: ModelInterpretation;   // Required, not optional
}

interface ModelConfig {
  provider: "openai" | "anthropic" | "deepseek" | "local" | "byok";
  apiKey?: string;
  model?: string;
  endpoint?: string;
}
```

## Ingestion Interfaces (L1)

```ts
interface RevisionFetcher {
  fetchRevisions(pageTitle: string, options?: RevisionOptions): Promise<Revision[]>;
}

interface Revision {
  revId: number;
  pageId: number;
  pageTitle: string;
  timestamp: string;
  comment: string;
  content: string;
  size: number;
  minor: boolean;
}
```
