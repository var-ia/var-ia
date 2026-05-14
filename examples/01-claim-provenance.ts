#!/usr/bin/env bun
/**
 * 01 — Claim Provenance
 *
 * Track a specific claim across Wikipedia's revision history:
 * when it first appeared, how it was reworded, what sources
 * supported it, and when (if) it was removed.
 *
 * This is the core use case Varia was built for.
 *
 * Usage: bun run examples/01-claim-provenance.ts
 */

import { MediaWikiClient } from "@var-ia/ingestion";
import {
  sectionDiffer,
  citationTracker,
  classifyClaimChange,
  buildSourceLineage,
  sanitizeWikitext,
} from "@var-ia/analyzers";
import { createClaimIdentity, createEventIdentity } from "@var-ia/evidence-graph";
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

console.log(`Claim identity: ${claimIdentity.claimId}`);
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

  const claimMoved = beforeSection?.title !== afterSection?.title;

  if (beforeText.includes(CLAIM_TEXT) && !afterText.includes(CLAIM_TEXT)) {
    events.push({
      eventType: "claim_removed",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "(lead)",
      before: beforeText,
      after: afterText,
      deterministicFacts: [{ fact: `claim "${CLAIM_TEXT}" removed from lead` }],
      layer: "observed",
      timestamp: after.timestamp,
    });
  } else if (!beforeText.includes(CLAIM_TEXT) && afterText.includes(CLAIM_TEXT)) {
    events.push({
      eventType: "claim_reintroduced",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "(lead)",
      before: beforeText,
      after: afterText,
      deterministicFacts: [{ fact: `claim "${CLAIM_TEXT}" (re)appeared in lead` }],
      layer: "observed",
      timestamp: after.timestamp,
    });
  } else if (beforeText.includes(CLAIM_TEXT) && afterText.includes(CLAIM_TEXT)) {
    const changeKind = classifyClaimChange(
      beforeText, afterText,
      beforeSection?.title, afterSection?.title,
    );
    if (changeKind !== "reworded") {
      events.push({
        eventType: `claim_${changeKind}` as EvidenceEvent["eventType"],
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "(lead)",
        before: beforeText.slice(0, 500),
        after: afterText.slice(0, 500),
        deterministicFacts: [
          { fact: `claim ${changeKind}`, detail: `revision ${before.revId} → ${after.revId}` },
        ],
        layer: "observed",
        timestamp: after.timestamp,
      });
    }
  }
}

if (events.length === 0) {
  console.log(`No claim changes detected for "${CLAIM_TEXT}" in the last ${DEPTH} revisions.`);
  console.log(`(The claim may be stable — typical for well-established articles.)`);
} else {
  console.log(`Detected ${events.length} claim events:`);
  for (const e of events) {
    console.log(`  [${e.timestamp}] ${e.eventType} (rev ${e.fromRevisionId} → ${e.toRevisionId})`);
    for (const f of e.deterministicFacts) {
      console.log(`    ${f.fact}${f.detail ? `: ${f.detail}` : ""}`);
    }
  }
}
