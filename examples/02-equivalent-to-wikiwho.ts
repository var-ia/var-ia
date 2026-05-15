#!/usr/bin/env bun
/**
 * 02 — Equivalent to WikiWho
 *
 * WikiWho provides token-level attribution — who wrote which word.
 * Refract provides structured evidence — what changed, how, and what
 * policy signals surrounded it.
 *
 * This script produces the WikiWho-equivalent output (who touched
 * what, when) but as structured events with deterministic facts
 * attached, plus citation and template context WikiWho doesn't give you.
 *
 * Usage: bun run examples/02-equivalent-to-wikiwho.ts
 */

import { MediaWikiClient } from "@var-ia/ingestion";
import {
  sectionDiffer,
  citationTracker,
  templateTracker,
  revertDetector,
  classifyHeuristic,
} from "@var-ia/analyzers";
import type { EvidenceEvent, Revision } from "@var-ia/evidence-graph";
import { createEventIdentity } from "@var-ia/evidence-graph";

const PAGE = "Albert_Einstein";
const DEPTH = 15;

const client = new MediaWikiClient({ minDelayMs: 200 });

const revisions = await client.fetchRevisions(PAGE, {
  direction: "newer",
  limit: DEPTH,
});

console.log(`"${PAGE}" — last ${revisions.length} revisions`);
console.log();
console.log("WikiWho gives you:  editor | token | revision");
console.log("Refract gives you:    event type | section | editor | diff context | citations | templates");
console.log();

const events: EvidenceEvent[] = [];

for (let i = 1; i < revisions.length; i++) {
  const before = revisions[i - 1];
  const after = revisions[i];

  const sections = sectionDiffer.diffSections(
    sectionDiffer.extractSections(before.content),
    sectionDiffer.extractSections(after.content),
  );

  const citations = citationTracker.diffCitations(
    citationTracker.extractCitations(before.content),
    citationTracker.extractCitations(after.content),
  );

  const templates = templateTracker.diffTemplates(
    templateTracker.extractTemplates(before.content),
    templateTracker.extractTemplates(after.content),
  );

  const heuristic = classifyHeuristic(after.comment, after.size - before.size);
  const isRevert = revertDetector.isRevert(after.comment);

  const changedSections = sections
    .filter((s) => s.changeType !== "unchanged")
    .map((s) => s.section)
    .join(", ");

  console.log(`rev ${after.revId} — ${after.timestamp.slice(0, 10)}`);
  console.log(`  editor: ${after.comment ? after.comment.split(" ")[0] + "…" : "(auto)"}`);
  console.log(`  heuristic: ${heuristic}${isRevert ? " [revert]" : ""}`);
  if (changedSections) console.log(`  sections touched: ${changedSections}`);
  if (citations.length > 0) {
    const summary = citations
      .filter((c) => c.type !== "unchanged")
      .map((c) => `${c.type}${c.after?.title ?? c.before?.title ?? ""}`);
    console.log(`  citations: ${summary.join(", ")}`);
  }
  if (templates.length > 0) {
    const summary = templates
      .filter((t) => t.type !== "unchanged")
      .map((t) => `${t.type} ${t.template.name}`);
    console.log(`  templates: ${summary.join(", ")}`);
  }
  console.log();
}
