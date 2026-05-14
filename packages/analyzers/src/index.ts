import type { Revision, Section, SectionChange } from "@var-ia/evidence-graph";

export interface SectionDiffer {
  extractSections(wikitext: string): Section[];
  diffSections(before: Section[], after: Section[]): SectionChange[];
}

export interface CitationTracker {
  extractCitations(wikitext: string): CitationRef[];
  diffCitations(before: CitationRef[], after: CitationRef[]): CitationChange[];
}

export interface CitationRef {
  url?: string;
  title?: string;
  refName?: string;
  raw: string;
}

export interface CitationChange {
  type: "added" | "removed" | "replaced" | "unchanged";
  before?: CitationRef;
  after?: CitationRef;
}

export interface RevertDetector {
  isRevert(comment: string): boolean;
  detectRevertChain(revisions: Revision[]): RevertChain[];
}

export interface RevertChain {
  startRevisionId: number;
  endRevisionId: number;
  revertedToRevisionId: number;
  participants: number;
}

export interface TemplateTracker {
  extractTemplates(wikitext: string): Template[];
  diffTemplates(before: Template[], after: Template[]): TemplateChange[];
}

export interface Template {
  name: string;              // e.g., "Citation needed", "NPOV", "BLP"
  type: TemplateType;
  params?: Record<string, string>;
}

export type TemplateType =
  | "citation"
  | "neutrality"
  | "blp"
  | "dispute"
  | "cleanup"
  | "protection"
  | "other";

export interface TemplateChange {
  type: "added" | "removed" | "unchanged";
  template: Template;
}

export { sectionDiffer, buildSectionLineage } from "./section-differ.js";
export type { SectionEvent, SectionLineage } from "./section-differ.js";
export { citationTracker, buildSourceLineage, buildSourceId } from "./citation-tracker.js";
export { revertDetector } from "./revert-detector.js";
export { templateTracker } from "./template-tracker.js";
export { classifyHeuristic } from "./heuristic-classifier.js";
export type { HeuristicKind } from "./heuristic-classifier.js";
export {
  sanitizeWikitext,
  extractHeadingMap,
  deriveSectionHeading,
  countCitations,
  countKeywordMentions,
  extractAnchorSnippet,
} from "./wikitext-parser.js";
export type { HeadingPosition } from "./wikitext-parser.js";
