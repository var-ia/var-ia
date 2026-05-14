import { MediaWikiClient } from "@var-ia/ingestion";
import { sectionDiffer, citationTracker, templateTracker, revertDetector } from "@var-ia/analyzers";
import type { EvidenceEvent, EvidenceLayer } from "@var-ia/evidence-graph";

const POLL_INTERVAL_MS = 60_000;

export async function runWatch(
  pageTitle: string,
  section?: string,
  apiUrl?: string,
): Promise<void> {
  const client = new MediaWikiClient(apiUrl ? { apiUrl } : undefined);
  console.log(`Watching "${pageTitle}"${section ? ` section="${section}"` : ""}`);
  console.log(`Polling every ${POLL_INTERVAL_MS / 1000}s. Press Ctrl+C to stop.\n`);

  let lastSeenRevId = 0;

  const poll = async () => {
    try {
      const revisions = await client.fetchRevisions(pageTitle, { limit: 5, direction: "newer" });
      if (revisions.length === 0) return;

      const sortedRevs = [...revisions].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const newRevs = sortedRevs.filter((r) => r.revId > lastSeenRevId);
      if (newRevs.length === 0) return;

      if (lastSeenRevId === 0) {
        const latest = sortedRevs[sortedRevs.length - 1];
        console.log(`[${new Date().toISOString()}] Initial watch — latest revision: ${latest.revId} (${latest.timestamp})`);
        lastSeenRevId = latest.revId;
        return;
      }

      for (const rev of newRevs) {
        const events: EvidenceEvent[] = [];
        const layer: EvidenceLayer = "observed";

        const prevIdx = sortedRevs.findIndex((r) => r.revId === rev.revId) - 1;
        if (prevIdx >= 0) {
          const before = sortedRevs[prevIdx];
          const citeChanges = citationTracker.diffCitations(
            citationTracker.extractCitations(before.content),
            citationTracker.extractCitations(rev.content),
          );

          for (const cit of citeChanges) {
            if (cit.type === "unchanged") continue;
            events.push({
              eventType: cit.type === "added" ? "citation_added" : cit.type === "removed" ? "citation_removed" : "citation_replaced",
              fromRevisionId: before.revId,
              toRevisionId: rev.revId,
              section: "body",
              before: cit.before?.raw ?? "",
              after: cit.after?.raw ?? "",
              deterministicFacts: [{ fact: "citation_changed", detail: `type=${cit.type}` }],
              layer,
              timestamp: rev.timestamp,
            });
          }

          const tplChanges = templateTracker.diffTemplates(
            templateTracker.extractTemplates(before.content),
            templateTracker.extractTemplates(rev.content),
          );
          for (const tpl of tplChanges) {
            if (tpl.type === "unchanged") continue;
            events.push({
              eventType: tpl.type === "added" ? "template_added" : "template_removed",
              fromRevisionId: before.revId,
              toRevisionId: rev.revId,
              section: "body",
              before: "",
              after: tpl.template.name,
              deterministicFacts: [{ fact: "template_changed", detail: `name=${tpl.template.name} type=${tpl.type}` }],
              layer,
              timestamp: rev.timestamp,
            });
          }

          if (revertDetector.isRevert(rev.comment)) {
            events.push({
              eventType: "revert_detected",
              fromRevisionId: before.revId,
              toRevisionId: rev.revId,
              section: "",
              before: "",
              after: rev.comment,
              deterministicFacts: [{ fact: "revert_detected", detail: rev.comment }],
              layer,
              timestamp: rev.timestamp,
            });
          }

          const secChanges = sectionDiffer.diffSections(
            sectionDiffer.extractSections(before.content),
            sectionDiffer.extractSections(rev.content),
          );
          for (const sc of secChanges) {
            if (sc.changeType === "unchanged") continue;
            if (section && sc.section !== section) continue;
            events.push({
              eventType: "section_reorganized",
              fromRevisionId: before.revId,
              toRevisionId: rev.revId,
              section: sc.section,
              before: sc.fromContent ?? "",
              after: sc.toContent ?? "",
              deterministicFacts: [{ fact: "section_changed", detail: `change=${sc.changeType}` }],
              layer,
              timestamp: rev.timestamp,
            });
          }
        }

        console.log(`\n[${rev.timestamp}] NEW REVISION ${rev.revId}`);
        console.log(`  Comment: ${rev.comment || "(none)"}`);
        console.log(`  Size: ${rev.size} bytes`);
        if (events.length > 0) {
          console.log(`  Events: ${events.length}`);
          for (const e of events) {
            console.log(`    - ${e.eventType} ${e.deterministicFacts.map((f) => f.detail).join(", ")}`);
          }
        }
      }

      lastSeenRevId = sortedRevs[sortedRevs.length - 1].revId;
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Watch error:`, (err as Error).message);
    }
  };

  await poll();
  const interval = setInterval(poll, POLL_INTERVAL_MS);

  const shutdown = () => {
    clearInterval(interval);
    console.log("\nWatch stopped.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
