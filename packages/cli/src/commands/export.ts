import { createHash } from "node:crypto";
import type { EvidenceEvent, PolicySignal, Report, Revision } from "@var-ia/evidence-graph";
import { createEventIdentity, createReplayManifest } from "@var-ia/evidence-graph";
import type { AuthConfig } from "@var-ia/ingestion";
import type { ModelConfig } from "@var-ia/interpreter";
import { runAnalyze } from "./analyze.js";

interface EvidenceBundle {
  format: "varia-evidence-bundle/v1";
  generatedAt: string;
  pageTitle: string;
  revisionRange: { from: number; to: number };
  inputRevisions: Revision[];
  outputEvents: EvidenceEvent[];
  bundleHash: string;
}

export async function runExport(
  pageTitle: string,
  format: string,
  modelConfig?: ModelConfig,
  apiUrl?: string,
  bundle?: boolean,
  auth?: AuthConfig,
  manifest?: boolean,
): Promise<void> {
  if (bundle) {
    const { events, revisions } = await runAnalyze(
      pageTitle,
      "detailed",
      undefined,
      undefined,
      undefined,
      false,
      modelConfig,
      apiUrl,
      undefined,
      undefined,
      false,
      auth,
    );
    const bundleData = buildBundle(pageTitle, events, revisions);
    console.log(JSON.stringify(bundleData, null, 2));
    return;
  }

  if (manifest) {
    const { events, revisions } = await runAnalyze(
      pageTitle,
      "detailed",
      undefined,
      undefined,
      undefined,
      false,
      modelConfig,
      apiUrl,
      undefined,
      undefined,
      false,
      auth,
    );
    const manifestData = createReplayManifest({
      pageTitle,
      analyzerVersions: { "var-ia": "0.3.1" },
      revisions,
      events,
    });
    console.log(JSON.stringify(manifestData, null, 2));
    return;
  }

  const { events } = await runAnalyze(
    pageTitle,
    "detailed",
    undefined,
    undefined,
    undefined,
    false,
    modelConfig,
    apiUrl,
    undefined,
    undefined,
    false,
    auth,
  );

  if (events.length === 0) {
    console.log("No events to export.");
    return;
  }

  if (format === "json") {
    const report = buildReport(pageTitle, events);
    console.log(JSON.stringify(report, null, 2));
  } else if (format === "csv") {
    console.log(toCSV(events));
  } else if (format === "ndjson") {
    for (const event of events) {
      console.log(
        JSON.stringify({
          ...event,
          eventId: event.eventId ?? createEventIdentity(event),
        }),
      );
    }
  } else {
    console.log(JSON.stringify(events, null, 2));
  }
}

function buildBundle(pageTitle: string, events: EvidenceEvent[], revisions: Revision[]): EvidenceBundle {
  const from = revisions[0]?.revId ?? 0;
  const to = revisions[revisions.length - 1]?.revId ?? 0;

  const taggedEvents = events.map((e) => ({
    ...e,
    eventId: e.eventId ?? createEventIdentity(e),
  }));

  const bundle = {
    format: "varia-evidence-bundle/v1" as const,
    generatedAt: new Date().toISOString(),
    pageTitle,
    revisionRange: { from, to },
    inputRevisions: revisions,
    outputEvents: taggedEvents,
  };

  const bundleHash = createHash("sha256").update(JSON.stringify(bundle)).digest("hex");

  return { ...bundle, bundleHash };
}

function buildReport(pageTitle: string, events: EvidenceEvent[]): Report {
  let minRev = Infinity;
  let maxRev = -Infinity;
  let earliest = "";
  let latest = "";
  let observedCount = 0;
  let policyCount = 0;
  let modelCount = 0;

  for (const e of events) {
    if (e.toRevisionId < minRev) minRev = e.toRevisionId;
    if (e.toRevisionId > maxRev) maxRev = e.toRevisionId;
    if (!earliest || e.timestamp < earliest) earliest = e.timestamp;
    if (!latest || e.timestamp > latest) latest = e.timestamp;
    observedCount++;
    if (e.layer === "policy_coded") policyCount++;
    if (e.modelInterpretation != null) modelCount++;
  }

  const layers: Report["layers"] = [
    { label: "observed", description: "Deterministic", events: observedCount, reproducible: true },
  ];
  if (policyCount > 0) {
    layers.push({
      label: "policy_coded",
      description: "Wikipedia policy signals",
      events: policyCount,
      reproducible: true,
    });
  }
  if (modelCount > 0) {
    layers.push({
      label: "model_interpretation",
      description: "Model-assisted semantic interpretation",
      events: modelCount,
      reproducible: false,
    });
  }

  const hasModel = modelCount > 0;

  return {
    pageTitle,
    pageId: 0,
    analyzedRevisionRange: {
      from: minRev === Infinity ? 0 : minRev,
      to: maxRev === -Infinity ? 0 : maxRev,
    },
    generatedAt: new Date().toISOString(),
    depth: "detailed",
    layers,
    timeline: {
      totalRevisions: observedCount,
      analyzedRevisions: observedCount,
      dateRange: {
        start: earliest,
        end: latest,
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
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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

    const existing = signalMap.get(key);
    if (existing) {
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
