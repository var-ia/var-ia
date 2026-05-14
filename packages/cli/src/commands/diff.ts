import { extractCategories, extractWikilinks } from "@var-ia/analyzers";
import type { EvidenceEvent } from "@var-ia/evidence-graph";
import type { ModelConfig } from "@var-ia/interpreter";
import { runAnalyze } from "./analyze.js";

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

export interface EventTypeDiff {
  eventType: string;
  counts: number[];
  diffs: number[];
}

export interface OutlierEntry {
  wikiIndex: number;
  wikiLabel: string;
  eventType: string;
  count: number;
  mean: number;
  stdDev: number;
  zScore: number;
}

export interface DiffResult {
  pageTitle: string;
  wikis: WikiSummary[];
  comparison: {
    eventTypeDiffs: EventTypeDiff[];
    totalEvents: number[];
    totalSections: number[];
  };
  outliers: OutlierEntry[];
  generatedAt: string;
}

export async function runDiff(
  topic: string,
  wikiUrls: string[],
  depth?: string,
  modelConfig?: ModelConfig,
): Promise<DiffResult> {
  console.log(`Diffing "${topic}" across ${wikiUrls.length} wikis...\n`);

  const resolvedDepth = depth ?? "detailed";
  const sharedConfig = modelConfig ? { ...modelConfig } : undefined;

  const labels = wikiUrls.length <= 26
    ? wikiUrls.map((_, i) => String.fromCharCode(65 + i))
    : wikiUrls.map((_, i) => `W${i + 1}`);

  for (let i = 0; i < wikiUrls.length; i++) {
    console.log(`Analyzing wiki ${labels[i]}: ${wikiUrls[i]}`);
  }

  const results = await Promise.all(
    wikiUrls.map((url) => buildSummary(topic, url, resolvedDepth, sharedConfig)),
  );
  const summaries = results.map((r) => r.summary);
  const allEvents = results.map((r) => r.events);

  const result: DiffResult = {
    pageTitle: topic,
    wikis: summaries,
    comparison: {
      eventTypeDiffs: buildEventTypeDiffsMatrix(summaries.map((s) => s.eventCounts)),
      totalEvents: allEvents.map((e) => e.length),
      totalSections: summaries.map((s) => s.sections.length),
    },
    outliers: detectOutliers(summaries, labels),
    generatedAt: new Date().toISOString(),
  };

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
    undefined,
    false,
    modelConfig,
    apiUrl,
  );

  const sections = new Set<string>();
  for (const e of events) {
    if (e.section) sections.add(e.section);
  }

  const latestContent = revisions.length > 0 ? revisions[revisions.length - 1].content : "";

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
        categories: extractCategories(latestContent).length,
        wikilinks: extractWikilinks(latestContent).length,
      },
    },
    events,
  };
}

function buildEventTypeDiffsMatrix(
  allCounts: Record<string, number>[],
): EventTypeDiff[] {
  const allTypes = new Set<string>();
  for (const counts of allCounts) {
    for (const key of Object.keys(counts)) {
      allTypes.add(key);
    }
  }

  const baseline = allCounts[0];
  const withSortKey = [...allTypes].map((eventType) => {
    const counts = allCounts.map((c) => c[eventType] ?? 0);
    const diffs = counts.map((c) => c - (baseline[eventType] ?? 0));
    const maxAbs = Math.max(...diffs.map(Math.abs));
    return { eventType, counts, diffs, maxAbs };
  });
  withSortKey.sort((a, b) => b.maxAbs - a.maxAbs);
  return withSortKey.map(({ eventType, counts, diffs }) => ({ eventType, counts, diffs }));
}

function detectOutliers(
  summaries: WikiSummary[],
  labels: string[],
): OutlierEntry[] {
  const allTypes = new Set<string>();
  for (const s of summaries) {
    for (const key of Object.keys(s.eventCounts)) {
      allTypes.add(key);
    }
  }

  const outliers: OutlierEntry[] = [];
  for (const eventType of allTypes) {
    const values = summaries.map((s) => s.eventCounts[eventType] ?? 0);
    const n = values.length;
    if (n < 3) continue;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) continue;

    for (let i = 0; i < n; i++) {
      const zScore = (values[i] - mean) / stdDev;
      if (Math.abs(zScore) > 2) {
        outliers.push({
          wikiIndex: i,
          wikiLabel: labels[i],
          eventType,
          count: values[i],
          mean: Math.round(mean * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
          zScore: Math.round(zScore * 100) / 100,
        });
      }
    }
  }

  return outliers.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}


