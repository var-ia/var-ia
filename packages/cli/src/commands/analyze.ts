import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { MediaWikiClient } from "@var-ia/ingestion";
import type { RevisionOptions } from "@var-ia/ingestion";
import { sectionDiffer, citationTracker, revertDetector, templateTracker, extractWikilinks, diffWikilinks, buildPageMoveEvents, extractCategories, diffCategories, classifyClaimChange, buildSectionLineage, protectionTracker, correlateTalkRevisions, buildParamChangeEvents, diffObservations } from "@var-ia/analyzers";
import type { TemplateType } from "@var-ia/analyzers";
import type { PageMove, ProtectionLogEvent } from "@var-ia/ingestion";
import type { EvidenceEvent, EvidenceLayer, Revision, DeterministicFact } from "@var-ia/evidence-graph";
import { createAdapter, ModelRouter } from "@var-ia/interpreter";
import type { ModelConfig } from "@var-ia/interpreter";
import { loadCachedRevisions, saveRevisions } from "./cache.js";
import { stripWikitext, fuzzyFindClaim, findSectionForText } from "./claim.js";

interface BatchPageResult {
  pageTitle: string;
  pageId: number;
  eventCount: number;
  events: EvidenceEvent[];
}

interface BatchResult {
  mode: "batch";
  batchSize: number;
  pages: BatchPageResult[];
  totalEvents: number;
  generatedAt: string;
}

function templateTypeToPolicyDimension(type: TemplateType): string | null {
  switch (type) {
    case "citation": return "verifiability";
    case "neutrality": return "npov";
    case "blp": return "blp";
    case "dispute": return "due_weight";
    case "protection": return "protection";
    default: return null;
  }
}

export async function runAnalyze(
  pageTitle: string,
  depth: string,
  fromRevId?: number,
  _toRevId?: number,
  fromTimestamp?: string,
  useCache = false,
  modelConfig?: ModelConfig,
  apiUrl?: string,
  pagesFile?: string,
  cacheDir?: string,
  useRouter = false,
): Promise<{ events: EvidenceEvent[]; revisions: Revision[] }> {
  if (pagesFile) {
    return runBatch(pagesFile, depth, fromRevId, _toRevId, fromTimestamp, useCache, modelConfig, apiUrl, cacheDir, useRouter);
  }
  const client = new MediaWikiClient(apiUrl ? { apiUrl } : undefined);
  console.log(`Analyzing "${pageTitle}" at depth: ${depth}...`);

  let revisions: Revision[] = [];

  if (useCache) {
    const cached = loadCachedRevisions(pageTitle, 20, cacheDir);
    if (cached.length > 0) {
      console.log(`Loaded ${cached.length} revisions from cache.`);
      revisions = cached;
    }
  }

  if (revisions.length === 0) {
    console.log(`Fetching revisions from Wikipedia...`);
    const options: RevisionOptions = { direction: "newer" };
    if (fromTimestamp) {
      options.start = new Date(fromTimestamp);
      console.log(`Fetching revisions since ${fromTimestamp}...`);
    } else if (fromRevId) {
      options.startRevId = fromRevId;
    }
    if (_toRevId) {
      options.endRevId = _toRevId;
    }
    if (!fromTimestamp && !fromRevId && !_toRevId) {
      options.limit = 20;
    }
    revisions = await client.fetchRevisions(pageTitle, options);
    console.log(`Fetched ${revisions.length} revisions.`);

    if (useCache && revisions.length > 0) {
      saveRevisions(revisions, cacheDir);
      console.log(`Cached ${revisions.length} revisions.`);
    }
  }

  if (revisions.length < 2) {
    console.log("Need at least 2 revisions to analyze.");
    return { events: [], revisions: [] };
  }

  const events: EvidenceEvent[] = [];
  const sortedRevs = [...revisions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const allSeenSentences = new Set<string>();

  const pageMoves: PageMove[] = await client.fetchPageMoves(pageTitle);
  const pageMoveEvents = buildPageMoveEvents(pageMoves);
  events.push(...pageMoveEvents);

  const protectionLogs: ProtectionLogEvent[] = await client.fetchProtectionLogs(pageTitle);

  for (let i = 1; i < sortedRevs.length; i++) {
    const before = sortedRevs[i - 1];
    const after = sortedRevs[i];

    const isBrief = depth === "brief";
    const isForensic = depth === "forensic";
    const extraFacts: DeterministicFact[] = isForensic
      ? [
          { fact: "full_wikitext_before", detail: before.content },
          { fact: "full_wikitext_after", detail: after.content },
        ]
      : [];

    const beforeSections = sectionDiffer.extractSections(before.content);
    const afterSections = sectionDiffer.extractSections(after.content);
    const sectionChanges = sectionDiffer.diffSections(beforeSections, afterSections);

    const beforeCitations = citationTracker.extractCitations(before.content);
    const afterCitations = citationTracker.extractCitations(after.content);
    const citationChanges = citationTracker.diffCitations(beforeCitations, afterCitations);

    const beforeWikilinks = extractWikilinks(before.content);
    const afterWikilinks = extractWikilinks(after.content);
    const wikilinkChanges = diffWikilinks(beforeWikilinks, afterWikilinks);

    const beforeCategories = extractCategories(before.content);
    const afterCategories = extractCategories(after.content);
    const categoryChanges = diffCategories(beforeCategories, afterCategories);

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
        before: isBrief ? "" : (cit.before?.raw ?? ""),
        after: isBrief ? "" : (cit.after?.raw ?? ""),
        deterministicFacts: [
          { fact: "citation_changed", detail: `type=${cit.type}` },
          ...extraFacts,
        ],
        layer,
        timestamp: after.timestamp,
      });
    }

    for (const link of wikilinkChanges.added) {
      events.push({
        eventType: "wikilink_added",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "body",
        before: "",
        after: isBrief ? "" : link,
        deterministicFacts: [
          { fact: "wikilink_added", detail: `target=${link}` },
          ...extraFacts,
        ],
        layer: "observed",
        timestamp: after.timestamp,
      });
    }

    for (const link of wikilinkChanges.removed) {
      events.push({
        eventType: "wikilink_removed",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "body",
        before: isBrief ? "" : link,
        after: "",
        deterministicFacts: [
          { fact: "wikilink_removed", detail: `target=${link}` },
          ...extraFacts,
        ],
        layer: "observed",
        timestamp: after.timestamp,
      });
    }

    for (const cat of categoryChanges.added) {
      events.push({
        eventType: "category_added",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "",
        before: "",
        after: isBrief ? "" : cat,
        deterministicFacts: [
          { fact: "category_added", detail: `category=${cat}` },
          ...extraFacts,
        ],
        layer: "observed",
        timestamp: after.timestamp,
      });
    }

    for (const cat of categoryChanges.removed) {
      events.push({
        eventType: "category_removed",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "",
        before: isBrief ? "" : cat,
        after: "",
        deterministicFacts: [
          { fact: "category_removed", detail: `category=${cat}` },
          ...extraFacts,
        ],
        layer: "observed",
        timestamp: after.timestamp,
      });
    }

    for (const tpl of templateChanges) {
      if (tpl.type === "unchanged") continue;

      if (tpl.template.type === "protection") {
        events.push({
          eventType: "protection_changed",
          fromRevisionId: before.revId,
          toRevisionId: after.revId,
          section: "body",
          before: tpl.type === "removed" ? tpl.template.name : "",
          after: tpl.type === "added" ? tpl.template.name : "",
          deterministicFacts: [
            { fact: "protection_changed", detail: `name=${tpl.template.name} type=${tpl.type}` },
            ...extraFacts,
          ],
          layer: "policy_coded",
          timestamp: after.timestamp,
        });
        continue;
      }

      const policyDimension = templateTypeToPolicyDimension(tpl.template.type);
      const layer: EvidenceLayer = policyDimension ? "policy_coded" : "observed";
      events.push({
        eventType: tpl.type === "added" ? "template_added" : "template_removed",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "body",
        before: "",
        after: isBrief ? "" : tpl.template.name,
        deterministicFacts: [
          { fact: "template_changed", detail: `name=${tpl.template.name} type=${tpl.type}` },
          ...(policyDimension ? [{ fact: "policy_signal", detail: `dimension=${policyDimension} signal=${tpl.template.name.toLowerCase().replace(/\s+/g, "_")}` }] : []),
          ...extraFacts,
        ],
        layer,
        timestamp: after.timestamp,
      });
    }

    const paramChangeEvents = buildParamChangeEvents(beforeTemplates, afterTemplates, before.revId, after.revId, after.timestamp);
    events.push(...paramChangeEvents);

    for (const sc of sectionChanges) {
      if (sc.changeType === "unchanged") continue;
      events.push({
        eventType: "section_reorganized",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: sc.section,
        before: isBrief ? "" : (sc.fromContent ?? ""),
        after: isBrief ? "" : (sc.toContent ?? ""),
        deterministicFacts: [
          { fact: "section_changed", detail: `change=${sc.changeType}` },
          ...extraFacts,
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
        after: isBrief ? "" : after.comment,
        deterministicFacts: [
          { fact: "revert_detected", detail: after.comment },
          { fact: "policy_signal", detail: "dimension=edit_warring signal=revert_detected" },
          ...extraFacts,
        ],
        layer: "policy_coded",
        timestamp: after.timestamp,
      });
    }

    const protectionLogsInRange = protectionTracker.findLogsBetween(
      protectionLogs,
      before.timestamp,
      after.timestamp,
    );
    for (const log of protectionLogsInRange) {
      events.push({
        eventType: "protection_changed",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "",
        before: "",
        after: log.action,
        deterministicFacts: [
          { fact: "protection_log_event", detail: `action=${log.action} logId=${log.logId}` },
          ...(log.comment ? [{ fact: "protection_summary", detail: log.comment }] : []),
          ...extraFacts,
        ],
        layer: "policy_coded",
        timestamp: log.timestamp,
      });
    }

    const leadChange = sectionChanges.find(
      sc => sc.section === "(lead)" && sc.changeType === "modified"
    );
    if (leadChange) {
      const fromLen = leadChange.fromContent?.length ?? 0;
      const toLen = leadChange.toContent?.length ?? 0;
      const contentMovedOut = fromLen > toLen && toLen < fromLen * 0.5;
      const contentMovedIn = toLen > fromLen && fromLen < toLen * 0.5;

      if (contentMovedOut) {
        const targetSection = sectionChanges.find(
          sc => sc.section !== "(lead)" && (sc.changeType === "added" || sc.changeType === "modified")
        );
        if (targetSection) {
          events.push({
            eventType: "lead_demotion",
            fromRevisionId: before.revId,
            toRevisionId: after.revId,
            section: targetSection.section,
            before: isBrief ? "" : (leadChange.fromContent ?? ""),
            after: isBrief ? "" : (leadChange.toContent ?? ""),
            deterministicFacts: [
              { fact: "lead_content_moved", detail: `from=lead to=${targetSection.section}` },
              ...extraFacts,
            ],
            layer: "observed",
            timestamp: after.timestamp,
          });
        }
      } else if (contentMovedIn) {
        const sourceSection = sectionChanges.find(
          sc => sc.section !== "(lead)" && (sc.changeType === "removed" || sc.changeType === "modified")
        );
        if (sourceSection) {
          events.push({
            eventType: "lead_promotion",
            fromRevisionId: before.revId,
            toRevisionId: after.revId,
            section: sourceSection.section,
            before: isBrief ? "" : (leadChange.fromContent ?? ""),
            after: isBrief ? "" : (leadChange.toContent ?? ""),
            deterministicFacts: [
              { fact: "lead_content_moved", detail: `from=${sourceSection.section} to=lead` },
              ...extraFacts,
            ],
            layer: "observed",
            timestamp: after.timestamp,
          });
        }
      }
    }

    const beforePlain = stripWikitext(before.content);
    const afterPlain = stripWikitext(after.content);

    const beforeSentences = beforePlain.split(/[.!?]\s+/).filter(s => s.trim().length > 20);
    const afterSentences = afterPlain.split(/[.!?]\s+/).filter(s => s.trim().length > 20);

    for (const sentence of afterSentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      const foundInBefore = fuzzyFindClaim(trimmed, beforePlain);
      if (!foundInBefore) {
        const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
        const wasSeenBefore = allSeenSentences.has(normalized);
        const section = findSectionForText(after.content, trimmed);
        events.push({
          eventType: wasSeenBefore ? "claim_reintroduced" : "claim_first_seen",
          fromRevisionId: before.revId,
          toRevisionId: after.revId,
          section,
          before: "",
          after: isBrief ? "" : trimmed,
          deterministicFacts: [
            { fact: "claim_detected", detail: `sentence_length=${trimmed.length}` },
            ...extraFacts,
          ],
          layer: "observed",
          timestamp: after.timestamp,
        });
      } else {
        const oldLen = foundInBefore.length;
        const newLen = trimmed.length;
        if (Math.abs(newLen - oldLen) > oldLen * 0.2) {
          const section = findSectionForText(after.content, trimmed);
          const beforeSection = findSectionForText(before.content, foundInBefore);
          const changeType = classifyClaimChange(foundInBefore, trimmed, beforeSection, section);
          events.push({
            eventType: changeType === "moved" ? "claim_moved" : changeType === "softened" ? "claim_softened" : changeType === "strengthened" ? "claim_strengthened" : "claim_reworded",
            fromRevisionId: before.revId,
            toRevisionId: after.revId,
            section,
            before: isBrief ? "" : foundInBefore,
            after: isBrief ? "" : trimmed,
            deterministicFacts: [
              { fact: "claim_changed", detail: `change=${changeType} old_length=${oldLen} new_length=${newLen}` },
              ...extraFacts,
            ],
            layer: "observed",
            timestamp: after.timestamp,
          });
        }
      }
    }

    for (const sentence of beforeSentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      const foundInAfter = fuzzyFindClaim(trimmed, afterPlain);
      if (!foundInAfter) {
        const section = findSectionForText(before.content, trimmed);
        events.push({
          eventType: "claim_removed",
          fromRevisionId: before.revId,
          toRevisionId: after.revId,
          section,
          before: isBrief ? "" : trimmed,
          after: "",
          deterministicFacts: [
            { fact: "claim_removed", detail: `sentence_length=${trimmed.length}` },
            ...extraFacts,
          ],
          layer: "observed",
          timestamp: after.timestamp,
        });
      }
    }

    for (const s of afterSentences) {
      const normalized = s.trim().toLowerCase().replace(/\s+/g, " ");
      if (normalized) allSeenSentences.add(normalized);
    }
  }

  const talkRevs = await client.fetchTalkRevisions(pageTitle, { direction: "newer", limit: 10 });
  if (talkRevs.length > 0) {
    const talkEvents = correlateTalkRevisions(sortedRevs, talkRevs);
    events.push(...talkEvents);
    if (talkEvents.length > 0) {
      console.log(`Correlated ${talkEvents.length} talk page discussions.`);
    }
  }

  if (fromTimestamp) {
    const obsDir = cacheDir ?? join(homedir(), ".wikihistory", "observations");
    if (!existsSync(obsDir)) mkdirSync(obsDir, { recursive: true });
    const obsFile = join(obsDir, `${pageTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);

    let priorEvents: EvidenceEvent[] = [];
    try {
      const raw = readFileSync(obsFile, "utf-8");
      priorEvents = JSON.parse(raw) as EvidenceEvent[];
    } catch { /* prior observation file may not exist yet */ }

    const obsDiff = diffObservations(priorEvents, events);
    if (priorEvents.length > 0) {
      console.log(`\n── Re-observation delta ──`);
      console.log(`  New events:      ${obsDiff.new.length}`);
      console.log(`  Resolved events: ${obsDiff.resolved.length}`);
      console.log(`  Unchanged:       ${obsDiff.unchanged.length}`);
    } else {
      console.log(`First observation — no delta available.`);
    }

    writeFileSync(obsFile, JSON.stringify(events, null, 2), "utf-8");
  }

  if (modelConfig && events.length > 0) {
    const adapter = createAdapter(modelConfig);
    console.log(`Interpreting ${events.length} events with ${modelConfig.provider}...`);

    const sectionLineage = buildSectionLineage(sortedRevs);
    const lineage = {
      sectionLineages: sectionLineage.map((s) => ({
        sectionName: s.sectionName,
        events: s.events.map((e) => `${e.eventType} in rev ${e.revisionId}`),
        isActive: s.isActive,
      })),
    };

    const interpreted = await adapter.interpret(events, lineage);
    for (let i = 0; i < interpreted.length; i++) {
      interpreted[i].layer = events[i].layer;
    }
    console.log("Interpretation complete.");
    return { events: interpreted, revisions: sortedRevs };
  }

  if (useRouter && events.length > 0) {
    const router = new ModelRouter();
    console.log(`Interpreting ${events.length} events with local open-weight models...`);

    const sectionLineage = buildSectionLineage(sortedRevs);
    const lineage = {
      sectionLineages: sectionLineage.map((s) => ({
        sectionName: s.sectionName,
        events: s.events.map((e) => `${e.eventType} in rev ${e.revisionId}`),
        isActive: s.isActive,
      })),
    };

    const interpreted = await router.interpret(events, lineage);
    for (let i = 0; i < interpreted.length; i++) {
      interpreted[i].layer = events[i].layer;
    }
    console.log("Interpretation complete.");
    return { events: interpreted, revisions: sortedRevs };
  }

  return { events, revisions: sortedRevs };
}

async function runBatch(
  pagesFile: string,
  depth: string,
  fromRevId?: number,
  toRevId?: number,
  fromTimestamp?: string,
  useCache = false,
  modelConfig?: ModelConfig,
  apiUrl?: string,
  cacheDir?: string,
  useRouter = false,
): Promise<{ events: EvidenceEvent[]; revisions: Revision[] }> {
  const content = readFileSync(pagesFile, "utf-8");
  const titles = content
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("#"));

  console.log(`Batch mode: ${titles.length} pages from ${pagesFile}\n`);

  const pages: BatchPageResult[] = [];
  const allEvents: EvidenceEvent[] = [];

  for (const title of titles) {
    console.log(`--- Page ${pages.length + 1}/${titles.length}: ${title} ---`);
    const { events } = await runAnalyze(title, depth, fromRevId, toRevId, fromTimestamp, useCache, modelConfig, apiUrl, undefined, cacheDir, useRouter);
    pages.push({
      pageTitle: title,
      pageId: 0,
      eventCount: events.length,
      events,
    });
    allEvents.push(...events);
  }

  const result: BatchResult = {
    mode: "batch",
    batchSize: titles.length,
    pages,
    totalEvents: allEvents.length,
    generatedAt: new Date().toISOString(),
  };

  console.log(`\n=== Batch Results ===`);
  console.log(`Pages processed: ${result.batchSize}`);
  console.log(`Total events: ${result.totalEvents}\n`);
  for (const p of result.pages) {
    console.log(`  ${p.pageTitle}: ${p.eventCount} events`);
  }

  return { events: allEvents, revisions: [] };
}
