import { runAnalyze } from "./analyze.js";
import type { EvidenceEvent, Report, PolicySignal } from "@var-ia/evidence-graph";
import type { ModelConfig } from "@var-ia/interpreter";

export async function runExport(
  pageTitle: string,
  format: string,
  modelConfig?: ModelConfig,
  apiUrl?: string,
): Promise<void> {
  const events = await runAnalyze(pageTitle, "detailed", undefined, undefined, false, modelConfig, apiUrl);

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

  const observedCount = events.length;
  const policyCount = events.filter((e) => e.layer === "policy_coded").length;
  const modelCount = events.filter((e) => e.modelInterpretation != null).length;

  const layers: Report["layers"] = [{ label: "observed", description: "Deterministic", events: observedCount, reproducible: true }];
  if (policyCount > 0) {
    layers.push({ label: "policy_coded", description: "Wikipedia policy signals", events: policyCount, reproducible: true });
  }
  if (modelCount > 0) {
    layers.push({ label: "model_interpretation", description: "Model-assisted semantic interpretation", events: modelCount, reproducible: false });
  }

  const hasModel = modelCount > 0;

  return {
    pageTitle,
    pageId: 0,
    analyzedRevisionRange: {
      from: sortedRevs[0] ?? 0,
      to: sortedRevs[sortedRevs.length - 1] ?? 0,
    },
    generatedAt: new Date().toISOString(),
    depth: "detailed",
    layers,
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
        layer: e.modelInterpretation ? "model_interpretation" : e.layer,
      })),
    },
    claims: [],
    sources: [],
    policySignals: extractPolicySignals(events),
    caveats: hasModel
      ? ["Model-assisted interpretation applied — confidence scores are per-event and may vary between runs."]
      : ["Deterministic analysis only — no model interpretation applied."],
    phase: "Phase 1b",
  };
}

function extractPolicySignals(events: EvidenceEvent[]): PolicySignal[] {
  const signalMap = new Map<string, PolicySignal>();
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  for (const event of sortedEvents) {
    if (event.layer !== "policy_coded") continue;
    const signalFact = event.deterministicFacts.find((f) => f.fact === "policy_signal");
    if (!signalFact?.detail) continue;

    const parts = signalFact.detail.split(" ");
    const dimMatch = parts.find((p) => p.startsWith("dimension="));
    const sigMatch = parts.find((p) => p.startsWith("signal="));
    if (!dimMatch || !sigMatch) continue;

    const dimension = dimMatch.slice("dimension=".length);
    const signal = sigMatch.slice("signal=".length);
    const key = `${dimension}:${signal}`;

    if (signalMap.has(key)) {
      const existing = signalMap.get(key)!;
      existing.lastSeenRevisionId = event.toRevisionId;
      existing.active = true;
    } else {
      signalMap.set(key, {
        dimension,
        signal,
        firstSeenRevisionId: event.toRevisionId,
        active: true,
      });
    }
  }

  return [...signalMap.values()];
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
