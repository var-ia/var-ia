#!/usr/bin/env bun
/**
 * 01 — Sentence Provenance
 *
 * Track a specific sentence across Wikipedia's revision history:
 * when it first appeared, how it changed, and when it was removed.
 *
 * Usage: bun run examples/01-claim-provenance.ts
 */

import { MediaWikiClient } from "@var-ia/ingestion";
import {
  sectionDiffer,
  citationTracker,
  sanitizeWikitext,
} from "@var-ia/analyzers";
import { createClaimIdentity } from "@var-ia/evidence-graph";
import type { EvidenceEvent, Revision } from "@var-ia/evidence-graph";

const PAGE = "Earth";
const CLAIM_TEXT = "third planet from the Sun";
const DEPTH = 10;

const client = new MediaWikiClient({ minDelayMs: 200 });

const revisions = await client.fetchRevisions(PAGE, {
  direction: "newer",
  limit: DEPTH,
});

if (revisions.length < 2) {
  console.log(`Need at least 2 revisions for ${PAGE}, got ${revisions.length}`);
  process.exit(0);
}

const claimIdentity = createClaimIdentity({
  text: CLAIM_TEXT,
  section: "(lead)",
  pageTitle: PAGE,
  pageId: revisions[0].pageId,
});

console.log(`Sentence identity: ${claimIdentity.claimId}`);
console.log(`Tracking "${CLAIM_TEXT}" across ${revisions.length} revisions of "${PAGE}"`);
console.log();

const events: EvidenceEvent[] = [];

for (let i = 1; i < revisions.length; i++) {
  const before = revisions[i - 1];
  const after = revisions[i];

  const beforeSection = sectionDiffer.extractSections(before.content)
    .find((s) => s.title === "(lead)");
  const afterSection = sectionDiffer.extractSections(after.content)
    .find((s) => s.title === "(lead)");

  const beforeText = sanitizeWikitext(beforeSection?.content ?? "");
  const afterText = sanitizeWikitext(afterSection?.content ?? "");

  if (beforeText.includes(CLAIM_TEXT) && !afterText.includes(CLAIM_TEXT)) {
    events.push({
      eventType: "sentence_removed",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "(lead)",
      before: beforeText,
      after: afterText,
      deterministicFacts: [{ fact: `sentence "${CLAIM_TEXT}" removed from lead` }],
      layer: "observed",
      timestamp: after.timestamp,
    });
  } else if (!beforeText.includes(CLAIM_TEXT) && afterText.includes(CLAIM_TEXT)) {
    events.push({
      eventType: "sentence_first_seen",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "(lead)",
      before: beforeText,
      after: afterText,
      deterministicFacts: [{ fact: `sentence "${CLAIM_TEXT}" (re)appeared in lead` }],
      layer: "observed",
      timestamp: after.timestamp,
    });
  }
}

if (events.length === 0) {
  console.log(`No sentence changes detected for "${CLAIM_TEXT}" in the last ${DEPTH} revisions.`);
  console.log(`(The sentence may be stable — typical for well-established articles.)`);
} else {
  console.log(`Detected ${events.length} sentence events:`);
  for (const e of events) {
    console.log(`  [${e.timestamp}] ${e.eventType} (rev ${e.fromRevisionId} → ${e.toRevisionId})`);
    for (const f of e.deterministicFacts) {
      console.log(`    ${f.fact}${f.detail ? `: ${f.detail}` : ""}`);
    }
  }
}
