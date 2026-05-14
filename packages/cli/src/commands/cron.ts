import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { diffObservations } from "@var-ia/analyzers";
import type { EvidenceEvent } from "@var-ia/evidence-graph";
import type { AuthConfig } from "@var-ia/ingestion";
import type { NotifyConfig } from "../notify.js";
import { sendNotifications } from "../notify.js";
import { runAnalyze } from "./analyze.js";

export interface CronReport {
  pageTitle: string;
  observedAt: string;
  priorObservationAt: string | null;
  eventsNew: number;
  eventsResolved: number;
  eventsUnchanged: number;
  deltaSummary: string;
}

export interface CronResult {
  reports: CronReport[];
  totalNewEvents: number;
  pagesProcessed: number;
  generatedAt: string;
}

export async function runCron(
  pagesFile: string,
  intervalHours?: number,
  apiUrl?: string,
  cacheDir?: string,
  notifyConfig?: NotifyConfig,
  auth?: AuthConfig,
): Promise<CronResult> {
  const content = readFileSync(pagesFile, "utf-8");
  const titles = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  console.log(`Cron: ${titles.length} pages from ${pagesFile}\n`);

  const baseDir = cacheDir ?? join(homedir(), ".wikihistory");
  const obsDir = join(baseDir, "observations");
  const reportsDir = join(baseDir, "reports");
  if (!existsSync(obsDir)) mkdirSync(obsDir, { recursive: true });
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

  const reports: CronReport[] = [];
  let totalNewEvents = 0;

  for (const title of titles) {
    const safeName = title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const obsFile = join(obsDir, `${safeName}.json`);

    let fromTimestamp: string | undefined;
    let priorObservationAt: string | null = null;

    if (intervalHours !== undefined && intervalHours > 0) {
      const d = new Date(Date.now() - intervalHours * 60 * 60 * 1000);
      fromTimestamp = d.toISOString();
    } else {
      try {
        const raw = readFileSync(obsFile, "utf-8");
        const priorEvents = JSON.parse(raw) as EvidenceEvent[];
        if (priorEvents.length > 0) {
          const lastTimestamp = priorEvents[priorEvents.length - 1].timestamp;
          priorObservationAt = lastTimestamp;
          fromTimestamp = lastTimestamp;
        }
      } catch {
        const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
        fromTimestamp = d.toISOString();
      }
    }

    console.log(`  ${title}: observing since ${fromTimestamp ?? "beginning"}...`);

    const { events } = await runAnalyze(
      title,
      "detailed",
      undefined,
      undefined,
      fromTimestamp,
      false,
      undefined,
      apiUrl,
      undefined,
      undefined,
      false,
      auth,
    );

    let priorEvents: EvidenceEvent[] = [];
    try {
      const raw = readFileSync(obsFile, "utf-8");
      priorEvents = JSON.parse(raw) as EvidenceEvent[];
    } catch {
      /* no prior observation file yet */
    }

    const isFirstObservation = priorEvents.length === 0;
    const obsDiff = diffObservations(priorEvents, events);

    const report: CronReport = {
      pageTitle: title,
      observedAt: new Date().toISOString(),
      priorObservationAt,
      eventsNew: isFirstObservation ? 0 : obsDiff.new.length,
      eventsResolved: isFirstObservation ? 0 : obsDiff.resolved.length,
      eventsUnchanged: isFirstObservation ? 0 : obsDiff.unchanged.length,
      deltaSummary: isFirstObservation
        ? "baseline established"
        : obsDiff.new.length > 0 || obsDiff.resolved.length > 0
          ? `${obsDiff.new.length} new, ${obsDiff.resolved.length} resolved`
          : "no changes",
    };
    reports.push(report);

    const reportFile = join(reportsDir, `${safeName}.json`);
    writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf-8");

    if (!isFirstObservation && obsDiff.new.length > 0) {
      totalNewEvents += obsDiff.new.length;
      console.log(`    ${obsDiff.new.length} new events, ${obsDiff.resolved.length} resolved`);
    } else {
      console.log(`    No changes`);
    }
  }

  const result: CronResult = {
    reports,
    totalNewEvents,
    pagesProcessed: titles.length,
    generatedAt: new Date().toISOString(),
  };

  console.log(`\n=== Cron Summary ===`);
  console.log(`Pages: ${titles.length}`);
  console.log(`Total new events: ${totalNewEvents}`);

  if (notifyConfig) {
    const changedDeltas = reports
      .filter((r) => r.eventsNew > 0 || r.eventsResolved > 0)
      .map((r) => ({
        pageTitle: r.pageTitle,
        eventsNew: r.eventsNew,
        eventsResolved: r.eventsResolved,
        deltaSummary: r.deltaSummary,
        wikiUrl: apiUrl,
      }));
    await sendNotifications(notifyConfig, changedDeltas);
  }

  return result;
}
