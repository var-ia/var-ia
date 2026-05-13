import { runAnalyze } from "./analyze.js";
import type { EvidenceEvent, Report } from "@var-ia/evidence-graph";

export async function runExport(
  pageTitle: string,
  format: string,
): Promise<void> {
  const events = await runAnalyze(pageTitle, "detailed");

  if (events.length === 0) {
    console.log("No events to export.");
    return;
  }

  if (format === "json") {
    const report = buildReport(pageTitle, events);
    console.log(JSON.stringify(report, null, 2));
  } else if (format === "csv") {
    console.log(toCSV(events));
  } else {
    console.log(JSON.stringify(events, null, 2));
  }
}

function buildReport(pageTitle: string, events: EvidenceEvent[]): Report {
  const sortedRevs = events.map((e) => e.toRevisionId).sort((a, b) => a - b);
  const timestamps = events.map((e) => e.timestamp).sort();

  return {
    pageTitle,
    pageId: 0,
    analyzedRevisionRange: {
      from: sortedRevs[0] ?? 0,
      to: sortedRevs[sortedRevs.length - 1] ?? 0,
    },
    generatedAt: new Date().toISOString(),
    depth: "detailed",
    layers: [
      { label: "observed", description: "Deterministic", events: events.length, reproducible: true },
    ],
    timeline: {
      totalRevisions: sortedRevs.length,
      analyzedRevisions: sortedRevs.length,
      dateRange: {
        start: timestamps[0] ?? "",
        end: timestamps[timestamps.length - 1] ?? "",
      },
      events: events.map((e) => ({
        revisionId: e.toRevisionId,
        timestamp: e.timestamp,
        eventType: e.eventType,
        summary: e.deterministicFacts.map((f) => f.fact).join("; "),
        layer: e.layer,
      })),
    },
    claims: [],
    sources: [],
    policySignals: [],
    caveats: ["Deterministic analysis only — no model interpretation applied."],
    phase: "Phase 1b",
  };
}

function toCSV(events: EvidenceEvent[]): string {
  const header = "timestamp,eventType,fromRevisionId,toRevisionId,section,before,after,facts";
  const rows = events.map((e) => {
    const facts = e.deterministicFacts.map((f) => f.fact + (f.detail ? `:${f.detail}` : "")).join("; ");
    return [
      e.timestamp,
      e.eventType,
      e.fromRevisionId,
      e.toRevisionId,
      csvEscape(e.section),
      csvEscape(e.before.slice(0, 200)),
      csvEscape(e.after.slice(0, 200)),
      csvEscape(facts),
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
