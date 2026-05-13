import { MediaWikiClient } from "@wikipedia-provenance/ingestion";
import { sectionDiffer, citationTracker, revertDetector, templateTracker } from "@wikipedia-provenance/analyzers";
import type { EvidenceEvent, EvidenceLayer } from "@wikipedia-provenance/evidence-graph";

const HELP = `
wikihistory — Wikipedia claim provenance engine

Usage:
  wikihistory analyze <page> [--depth brief|detailed|forensic]
  wikihistory claim <page> --text "<claim text>"
  wikihistory export <page> --format json|pdf|csv
  wikihistory watch <page> [--section <name>]

Options:
  --depth      Analysis depth (default: detailed)
  --text       Claim text to track across revisions
  --format     Export format
  --section    Watch a specific section only
  --from       Start revision ID
  --to         End revision ID
`;

export async function cli(args: string[]): Promise<void> {
  const command = args[0];

  switch (command) {
    case "analyze": {
      const pageTitle = args[1];
      if (!pageTitle) {
        console.error("Usage: wikihistory analyze <page> [--depth brief|detailed|forensic]");
        process.exit(1);
      }
      const depth = parseFlag(args, "depth") ?? "detailed";
      const fromRev = parseFlag(args, "from");
      const toRev = parseFlag(args, "to");

      await runAnalyze(pageTitle, depth, fromRev ? parseInt(fromRev, 10) : undefined, toRev ? parseInt(toRev, 10) : undefined);
      break;
    }
    case "claim":
      console.log("claim: not yet implemented");
      break;
    case "export":
      console.log("export: not yet implemented");
      break;
    case "watch":
      console.log("watch: not yet implemented");
      break;
    case "--help":
    case "-h":
    default:
      console.log(HELP);
      break;
  }
}

async function runAnalyze(
  pageTitle: string,
  depth: string,
  fromRevId?: number,
  _toRevId?: number,
): Promise<void> {
  const client = new MediaWikiClient();
  console.log(`Analyzing "${pageTitle}" at depth: ${depth}...`);
  console.log(`Fetching revisions from Wikipedia...`);

  const options: { limit?: number; direction?: "newer" | "older" } = { limit: 20, direction: "newer" };
  if (fromRevId) {
    // If we have a fromRevId, we'll fetch starting from that point
  }
  const revisions = await client.fetchRevisions(pageTitle, options);
  console.log(`Fetched ${revisions.length} revisions.`);

  if (revisions.length < 2) {
    console.log("Need at least 2 revisions to analyze.");
    return;
  }

  const events: EvidenceEvent[] = [];
  const sortedRevs = [...revisions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 1; i < sortedRevs.length; i++) {
    const before = sortedRevs[i - 1];
    const after = sortedRevs[i];

    const beforeSections = sectionDiffer.extractSections(before.content);
    const afterSections = sectionDiffer.extractSections(after.content);
    const sectionChanges = sectionDiffer.diffSections(beforeSections, afterSections);

    const beforeCitations = citationTracker.extractCitations(before.content);
    const afterCitations = citationTracker.extractCitations(after.content);
    const citationChanges = citationTracker.diffCitations(beforeCitations, afterCitations);

    const beforeTemplates = templateTracker.extractTemplates(before.content);
    const afterTemplates = templateTracker.extractTemplates(after.content);
    const templateChanges = templateTracker.diffTemplates(beforeTemplates, afterTemplates);

    const isRevRevert = revertDetector.isRevert(after.comment);

    for (const cit of citationChanges) {
      if (cit.type === "unchanged") continue;
      const layer: EvidenceLayer = "observed";
      events.push({
        eventType: cit.type === "added" ? "citation_added" : cit.type === "removed" ? "citation_removed" : "citation_replaced",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "body",
        before: cit.before?.raw ?? "",
        after: cit.after?.raw ?? "",
        deterministicFacts: [
          { fact: "citation_changed", detail: `type=${cit.type}` },
        ],
        layer,
        timestamp: after.timestamp,
      });
    }

    for (const tpl of templateChanges) {
      if (tpl.type === "unchanged") continue;
      events.push({
        eventType: tpl.type === "added" ? "template_added" : "template_removed",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "body",
        before: "",
        after: tpl.template.name,
        deterministicFacts: [
          { fact: "template_changed", detail: `name=${tpl.template.name} type=${tpl.type}` },
        ],
        layer: "observed",
        timestamp: after.timestamp,
      });
    }

    for (const sc of sectionChanges) {
      if (sc.changeType === "unchanged") continue;
      events.push({
        eventType: sc.changeType === "added" ? "section_reorganized" : sc.changeType === "removed" ? "section_reorganized" : sc.changeType === "modified" ? "section_reorganized" : "section_reorganized",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: sc.section,
        before: sc.fromContent ?? "",
        after: sc.toContent ?? "",
        deterministicFacts: [
          { fact: "section_changed", detail: `change=${sc.changeType}` },
        ],
        layer: "observed",
        timestamp: after.timestamp,
      });
    }

    if (isRevRevert) {
      events.push({
        eventType: "revert_detected",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "",
        before: "",
        after: after.comment,
        deterministicFacts: [
          { fact: "revert_detected", detail: after.comment },
        ],
        layer: "observed",
        timestamp: after.timestamp,
      });
    }
  }

  console.log(`\n=== Analysis Results ===`);
  console.log(`Page: ${pageTitle}`);
  console.log(`Revisions analyzed: ${sortedRevs.length}`);
  console.log(`Events detected: ${events.length}`);
  console.log();

  for (const event of events) {
    console.log(`[${event.timestamp}] ${event.eventType} (rev ${event.fromRevisionId}→${event.toRevisionId})`);
    if (event.section) console.log(`  Section: ${event.section}`);
    for (const fact of event.deterministicFacts) {
      console.log(`  • ${fact.fact}${fact.detail ? `: ${fact.detail}` : ""}`);
    }
  }
}

function parseFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  const eqIdx = args.findIndex((a) => a.startsWith(`--${name}=`));
  if (eqIdx >= 0) {
    return args[eqIdx].split("=")[1];
  }
  return undefined;
}
