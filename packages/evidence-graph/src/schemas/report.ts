// Report — the assembled output of the provenance engine

import type { EvidenceLayer } from "./evidence.js";

export type ReportLayerLabel = EvidenceLayer;

export type ExportFormat = "json" | "pdf" | "csv" | "html";

export type Depth = "brief" | "detailed" | "forensic";

export interface ReportLayer {
  label: ReportLayerLabel;
  description: string;
  events: number;
  reproducible: boolean;
}

export interface Report {
  pageTitle: string;
  pageId: number;
  analyzedRevisionRange: { from: number; to: number };
  generatedAt: string; // ISO 8601
  depth: Depth;
  layers: ReportLayer[];
  timeline: PageTimeline;
  claims: string[]; // Claim IDs
  sources: string[]; // Source IDs
  policySignals: PolicySignal[];
  caveats: string[];
  phase: string;
}

export interface PageTimeline {
  totalRevisions: number;
  analyzedRevisions: number;
  dateRange: { start: string; end: string };
  events: TimelineEvent[];
}

export interface TimelineEvent {
  revisionId: number;
  timestamp: string;
  eventType: string;
  summary: string;
  layer: ReportLayerLabel;
}

export interface PolicySignal {
  dimension: string; // e.g., "verifiability", "npov", "blp", "due_weight"
  signal: string; // e.g., "citation_needed_template_added", "blp_template_active"
  firstSeenRevisionId: number;
  lastSeenRevisionId?: number;
  active: boolean;
}
