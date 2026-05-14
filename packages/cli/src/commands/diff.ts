import { runAnalyze } from "./analyze.js";
import type { ModelConfig } from "@var-ia/interpreter";
import { extractWikilinks, extractCategories } from "@var-ia/analyzers";
import type { EvidenceEvent } from "@var-ia/evidence-graph";

interface DiffResult {
  pageTitle: string;
  wikiA: WikiSummary;
  wikiB: WikiSummary;
  comparison: {
    eventTypeDiffs: { eventType: string; aCount: number; bCount: number; diff: number }[];
    totalEventsA: number;
    totalEventsB: number;
  };
  generatedAt: string;
}

interface WikiSummary {
  url: string;
  sections: string[];
  eventCounts: Record<string, number>;
  summary: {
    citations: number;
    templates: number;
    reverts: number;
    categories: number;
    wikilinks: number;
  };
}

export async function runDiff(
  topic: string,
  wikiAUrl: string,
  wikiBUrl: string,
  depth?: string,
  modelConfig?: ModelConfig,
): Promise<DiffResult> {
  console.log(`Diffing "${topic}" across two wikis...\n`);

  const resolvedDepth = depth ?? "detailed";
  const sharedConfig = modelConfig
    ? { ...modelConfig }
    : undefined;

  console.log(`Analyzing wiki A: ${wikiAUrl}`);
  const { summary: summaryA, events: eventsA } = await buildSummary(topic, wikiAUrl, resolvedDepth, sharedConfig);

  console.log(`\nAnalyzing wiki B: ${wikiBUrl}`);
  const { summary: summaryB, events: eventsB } = await buildSummary(topic, wikiBUrl, resolvedDepth, sharedConfig);

  const result: DiffResult = {
    pageTitle: topic,
    wikiA: summaryA,
    wikiB: summaryB,
    comparison: {
      eventTypeDiffs: buildEventTypeDiffs(summaryA.eventCounts, summaryB.eventCounts),
      totalEventsA: eventsA.length,
      totalEventsB: eventsB.length,
    },
    generatedAt: new Date().toISOString(),
  };

  printDiff(result);
  return result;
}

async function buildSummary(
  topic: string,
  apiUrl: string,
  depth: string,
  modelConfig?: ModelConfig,
): Promise<{ summary: WikiSummary; events: EvidenceEvent[] }> {
  const { events, revisions } = await runAnalyze(
    topic,
    depth,
    undefined,
    undefined,
    false,
    modelConfig,
    apiUrl,
  );

  const sections = new Set<string>();
  for (const e of events) {
    if (e.section) sections.add(e.section);
  }

  const allContent = revisions.map((r) => r.content).join("\n");

  const eventCounts: Record<string, number> = {};
  let citationCount = 0;
  let templateCount = 0;
  let revertCount = 0;

  for (const e of events) {
    eventCounts[e.eventType] = (eventCounts[e.eventType] ?? 0) + 1;
    if (e.eventType.startsWith("citation_")) citationCount++;
    if (e.eventType.startsWith("template_")) templateCount++;
    if (e.eventType === "revert_detected") revertCount++;
  }

  return {
    summary: {
      url: apiUrl,
      sections: [...sections],
      eventCounts,
      summary: {
        citations: citationCount,
        templates: templateCount,
        reverts: revertCount,
        categories: extractCategories(allContent).length,
        wikilinks: extractWikilinks(allContent).length,
      },
    },
    events,
  };
}

function buildEventTypeDiffs(
  aCounts: Record<string, number>,
  bCounts: Record<string, number>,
): { eventType: string; aCount: number; bCount: number; diff: number }[] {
  const allTypes = new Set([...Object.keys(aCounts), ...Object.keys(bCounts)]);
  return [...allTypes]
    .map((eventType) => {
      const a = aCounts[eventType] ?? 0;
      const b = bCounts[eventType] ?? 0;
      return { eventType, aCount: a, bCount: b, diff: b - a };
    })
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}

function printDiff(result: DiffResult): void {
  const { wikiA, wikiB, comparison } = result;

  console.log(`\n=== Cross-Wiki Diff: "${result.pageTitle}" ===`);
  console.log(`Wiki A: ${wikiA.url}`);
  console.log(`Wiki B: ${wikiB.url}\n`);

  console.log("── Overview ──");
  console.log(`  Total events: A=${comparison.totalEventsA}, B=${comparison.totalEventsB}`);
  console.log(`  Sections:     A=${wikiA.sections.length}, B=${wikiB.sections.length}`);
  console.log(`  Citations:    A=${wikiA.summary.citations}, B=${wikiB.summary.citations}`);
  console.log(`  Templates:    A=${wikiA.summary.templates}, B=${wikiB.summary.templates}`);
  console.log(`  Reverts:      A=${wikiA.summary.reverts}, B=${wikiB.summary.reverts}`);
  console.log(`  Categories:   A=${wikiA.summary.categories}, B=${wikiB.summary.categories}`);
  console.log(`  Wikilinks:    A=${wikiA.summary.wikilinks}, B=${wikiB.summary.wikilinks}\n`);

  if (comparison.eventTypeDiffs.length > 0) {
    console.log("── Event Type Breakdown ──");
    console.log("  Event Type                  A    B    Δ");
    console.log("  ─────────────────────────────────────");
    for (const d of comparison.eventTypeDiffs) {
      const label = d.eventType.padEnd(28);
      const sign = d.diff > 0 ? "+" : "";
      console.log(`  ${label} ${String(d.aCount).padStart(4)} ${String(d.bCount).padStart(4)} ${sign}${d.diff}`);
    }
  }
}
