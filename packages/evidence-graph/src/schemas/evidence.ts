// Evidence event — what happened at a revision boundary

export type EvidenceLayer = "observed" | "policy_coded" | "model_interpretation" | "speculative" | "unknown";

export type EventType =
  | "claim_first_seen"
  | "claim_removed"
  | "claim_softened"
  | "claim_strengthened"
  | "claim_reworded"
  | "claim_moved"
  | "citation_added"
  | "citation_removed"
  | "citation_replaced"
  | "template_added"
  | "template_removed"
  | "revert_detected"
  | "section_reorganized"
  | "lead_promotion"
  | "lead_demotion"
  | "page_moved"
  | "protection_changed"
  | "talk_page_correlated";

export interface DeterministicFact {
  fact: string;              // e.g., "text_changed", "attribution_added", "same_section"
  detail?: string;
}

export interface ModelInterpretation {
  semanticChange: string;    // e.g., "direct accusation changed to attributed institutional finding"
  confidence: number;        // 0.0–1.0
  policyDimension?: string;  // e.g., "verifiability", "npov", "blp", "due_weight"
}

export interface EvidenceEvent {
  eventType: EventType;
  claimId?: string;
  fromRevisionId: number;
  toRevisionId: number;
  section: string;
  before: string;
  after: string;
  deterministicFacts: DeterministicFact[];
  modelInterpretation?: ModelInterpretation;
  layer: EvidenceLayer;
  timestamp: string;         // ISO 8601
}
