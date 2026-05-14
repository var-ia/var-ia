// Claim object — the core provenance unit

export type PropositionType =
  | "factual_claim"
  | "attributed_claim"
  | "institutional_finding"
  | "allegation"
  | "counterclaim"
  | "policy_statement"
  | "editorial_note"
  | "unknown";

export type ClaimState =
  | "absent"
  | "emerging"
  | "contested"
  | "softened"
  | "strengthened"
  | "stabilizing"
  | "hardened"
  | "receding"
  | "deleted"
  | "reintroduced";

export interface ClaimIdentity {
  claimId: string; // Deterministic hash from identity key
  identityKey: string; // Canonical claim text + section + page
  pageTitle: string;
  pageId: number;
}

export interface ClaimVariant {
  revisionId: number;
  text: string;
  section: string;
  observedAt: string; // ISO 8601
}

export interface ClaimLineage {
  firstSeenRevisionId: number;
  firstSeenAt: string; // ISO 8601
  lastSeenRevisionId?: number;
  lastSeenAt?: string;
  variants: ClaimVariant[];
  mergeSourceIds?: string[];
  splitTargetIds?: string[];
  deprecatedAt?: string;
  deprecatedByClaimId?: string;
}

export interface ClaimObject {
  identity: ClaimIdentity;
  lineage: ClaimLineage;
  currentState: ClaimState;
  propositionType: PropositionType;
  sourceLineage: string[]; // SourceRecord IDs
  phase: string; // Phase tag: Phase 0 | Phase 1b | Phase 2a | Phase 2b
}
