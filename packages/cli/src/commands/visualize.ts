import type { AuthConfig } from "@var-ia/ingestion";
import type { EvidenceEvent, Revision } from "@var-ia/evidence-graph";
import { runAnalyze } from "./analyze.js";

const CLAIM_EVENT_TYPES = new Set([
  "claim_first_seen",
  "claim_removed",
  "claim_softened",
  "claim_strengthened",
  "claim_reworded",
  "claim_moved",
  "claim_reintroduced",
]);

const EVENT_COLORS: Record<string, string> = {
  claim_first_seen: "#4caf50",
  claim_reintroduced: "#8bc34a",
  claim_removed: "#f44336",
  claim_softened: "#ffc107",
  claim_strengthened: "#ff9800",
  claim_reworded: "#2196f3",
  claim_moved: "#9c27b0",
  citation_added: "#00bcd4",
  citation_removed: "#e91e63",
  citation_replaced: "#ff5722",
};

export async function runVisualize(
  pageTitle: string,
  format: string,
  showAll?: boolean,
  apiUrl?: string,
  auth?: AuthConfig,
): Promise<void> {
  const { events, revisions } = await runAnalyze(
    pageTitle,
    "detailed",
    undefined,
    undefined,
    undefined,
    false,
    undefined,
    apiUrl,
    undefined,
    undefined,
    false,
    auth,
  );

  if (events.length === 0) {
    console.log("No events to visualize.");
    return;
  }

  const sortedRevs = [...revisions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const filteredEvents = showAll ? events : events.filter((e) => CLAIM_EVENT_TYPES.has(e.eventType));

  if (filteredEvents.length === 0) {
    console.log(showAll ? "No events to visualize." : "No claim events to visualize. Use --all for full event stream.");
    return;
  }

  if (format === "dot") {
    printDot(sortedRevs, filteredEvents);
  } else {
    printMermaid(sortedRevs, filteredEvents);
  }
}

function eventLabel(event: EvidenceEvent): string {
  const label = event.eventType.replace(/_/g, " ");
  const text = event.after ? event.after.slice(0, 60) : event.before.slice(0, 60);
  if (text) return `${label}: ${text}${text.length >= 60 ? "..." : ""}`;
  return label;
}

function printMermaid(revisions: Revision[], events: EvidenceEvent[]): void {
  console.log("graph LR");
  console.log();

  const labels: string[] = [];

  for (let i = 0; i < revisions.length; i++) {
    const r = revisions[i];
    const nodeId = `R${r.revId}`;
    const date = r.timestamp.slice(0, 10);
    labels.push(`  ${nodeId}["rev ${r.revId}<br/>${date}"]`);
  }

  for (let i = 0; i < revisions.length - 1; i++) {
    const from = revisions[i];
    const to = revisions[i + 1];
    const revEvents = events.filter(
      (e) => e.fromRevisionId === from.revId && e.toRevisionId === to.revId,
    );
    if (revEvents.length === 0) {
      labels.push(`  R${from.revId} --> R${to.revId}`);
    } else {
      const subgraphId = `SG${from.revId}`;
      labels.push(`  subgraph ${subgraphId}["rev ${from.revId} → rev ${to.revId}"]`);
      for (const ev of revEvents) {
        const evId = `E${ev.fromRevisionId}_${ev.toRevisionId}_${ev.eventType.replace(/[^a-z]/g, "_")}`;
        const color = EVENT_COLORS[ev.eventType] ?? "#999";
        const label = eventLabel(ev).replace(/"/g, "#quot;");
        labels.push(`    ${evId}["${label}"]`);
        labels.push(`    style ${evId} fill:${color},stroke:#333,stroke-width:1px`);
      }
      labels.push(`  end`);
      if (i < revisions.length - 2) {
        const nextRev = revisions[i + 1];
        labels.push(`  ${subgraphId} --> R${nextRev.revId}`);
      }
    }
  }

  for (const r of revisions) {
    labels.push(`  style R${r.revId} fill:#e3f2fd,stroke:#1565c0,stroke-width:2px`);
  }

  console.log(labels.join("\n"));
}

function printDot(revisions: Revision[], events: EvidenceEvent[]): void {
  console.log("digraph {");
  console.log("  rankdir=LR;");
  console.log('  node [shape=box, style="rounded,filled", fillcolor="#e3f2fd"];');
  console.log();

  for (const r of revisions) {
    const date = r.timestamp.slice(0, 10);
    console.log(`  "rev_${r.revId}" [label="rev ${r.revId}\\n${date}"];`);
  }

  for (let i = 0; i < revisions.length - 1; i++) {
    const from = revisions[i];
    const to = revisions[i + 1];
    const revEvents = events.filter(
      (e) => e.fromRevisionId === from.revId && e.toRevisionId === to.revId,
    );

    if (revEvents.length === 0) {
      console.log(`  "rev_${from.revId}" -> "rev_${to.revId}";`);
    } else {
      const evLabels = revEvents.map((e) => eventLabel(e).replace(/"/g, '\\"'));
      const label = evLabels.join("\\n");
      const color = EVENT_COLORS[revEvents[0].eventType] ?? "#999";
      console.log(`  "rev_${from.revId}" -> "rev_${to.revId}" [label="${label}", color="${color}", fontcolor="${color}"];`);
    }
  }

  console.log("}");
}
