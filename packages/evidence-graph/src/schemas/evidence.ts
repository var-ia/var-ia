// Evidence event — what happened at a revision boundary

export type EvidenceLayer = "observed" | "policy_coded" | "model_interpretation" | "speculative" | "unknown";

export type EventType =
  | "claim_first_seen"
  | "claim_removed"
  | "claim_softened"
  | "claim_strengthened"
  | "claim_reworded"
  | "claim_moved"
  | "claim_reintroduced"
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
  | "wikilink_added"
  | "wikilink_removed"
  | "category_added"
  | "category_removed"
  | "protection_changed"
  | "talk_page_correlated"
  | "talk_thread_opened"
  | "talk_thread_archived"
  | "talk_reply_added"
  | "template_parameter_changed"
  | "edit_cluster_detected"
  | "talk_activity_spike";

export interface FactProvenance {
  analyzer: string;
  version: string;
  inputHashes: string[];
}

export type PolicyDimension =
  | "verifiability"
  | "npov"
  | "blp"
  | "due_weight"
  | "protection"
  | "edit_warring"
  | "notability"
  | "copyright"
  | "civility";

export interface DeterministicFact {
  fact: string;
  detail?: string;
  provenance?: FactProvenance;
}

export interface ModelInterpretation {
  semanticChange: string;
  confidence: number;
  policyDimension?: PolicyDimension;
  discussionType?:
    | "notability_challenge"
    | "sourcing_dispute"
    | "neutrality_concern"
    | "content_deletion"
    | "content_addition"
    | "naming_dispute"
    | "procedural"
    | "other";
}

export interface EvidenceEvent {
  eventId?: string;
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
  timestamp: string; // ISO 8601
}
