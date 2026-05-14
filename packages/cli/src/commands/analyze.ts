import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CitationRef, Template, TemplateType } from "@var-ia/analyzers";
import {
  buildPageMoveEvents,
  buildParamChangeEvents,
  buildSectionLineage,
  citationTracker,
  classifyClaimChange,
  correlateTalkRevisions,
  diffCategories,
  diffObservations,
  diffWikilinks,
  extractCategories,
  extractWikilinks,
  revertDetector,
  sectionDiffer,
  templateTracker,
} from "@var-ia/analyzers";
import type { DeterministicFact, EvidenceEvent, EvidenceLayer, Revision, Section } from "@var-ia/evidence-graph";
import type { AuthConfig, RevisionOptions } from "@var-ia/ingestion";
import { MediaWikiClient } from "@var-ia/ingestion";
import type { ModelConfig } from "@var-ia/interpreter";
import { createAdapter, ModelRouter } from "@var-ia/interpreter";
import { loadCachedRevisions, loadLatestCachedTimestamp, saveRevisions } from "./cache.js";
import { buildSectionCharMap, findSectionForText, fuzzyFindClaim, stripWikitext } from "./claim.js";

interface ParsedContent {
  sections: Section[];
  citations: CitationRef[];
  wikilinks: string[];
  categories: string[];
  templates: Template[];
}

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
    case "citation":
      return "verifiability";
    case "neutrality":
      return "npov";
    case "blp":
      return "blp";
    case "dispute":
      return "due_weight";
    case "protection":
      return "protection";
    default:
      return null;
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
  auth?: AuthConfig,
): Promise<{ events: EvidenceEvent[]; revisions: Revision[] }> {
  if (pagesFile) {
    return runBatch(
      pagesFile,
      depth,
      fromRevId,
      _toRevId,
      fromTimestamp,
      useCache,
      modelConfig,
      apiUrl,
      cacheDir,
      useRouter,
      auth,
    );
  }
  const client = new MediaWikiClient(apiUrl ? { apiUrl, auth } : auth ? { auth } : undefined);
  console.log(`Analyzing "${pageTitle}" at depth: ${depth}...`);

  let revisions: Revision[] = [];

  if (useCache) {
    const cached = loadCachedRevisions(pageTitle, 500, cacheDir);
    if (cached.length > 0) {
      console.log(`Loaded ${cached.length} revisions from cache.`);
      revisions = cached;

      const latestTs = loadLatestCachedTimestamp(pageTitle, cacheDir);
      if (latestTs && !fromTimestamp && revisions.length < 500) {
        const deltaOpts: RevisionOptions = { direction: "newer", start: new Date(latestTs) };
        if (_toRevId) deltaOpts.endRevId = _toRevId;
        const newRevisions = await client.fetchRevisions(pageTitle, deltaOpts);
        const uniqueNew = newRevisions.filter((r) => !revisions.some((cr) => cr.revId === r.revId));
        if (uniqueNew.length > 0) {
          console.log(`Fetched ${uniqueNew.length} new revisions since ${latestTs}.`);
          revisions = [...revisions, ...uniqueNew];
          saveRevisions(uniqueNew, cacheDir);
        } else {
          console.log("Cache is up to date.");
        }
      }
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
  const withTs = revisions.map((r) => ({ r, ts: new Date(r.timestamp).getTime() }));
  withTs.sort((a, b) => a.ts - b.ts);
  const sortedRevs = withTs.map((x) => x.r);

  const allSeenSentences = new Set<string>();
  const strippedCache = new Map<number, string>();
  const sectionCharMapCache = new Map<number, Array<{ charOffset: number; section: string }>>();

  const getStripped = (rev: Revision): string => {
    const cached = strippedCache.get(rev.revId);
    if (cached !== undefined) return cached;
    const result = stripWikitext(rev.content);
    strippedCache.set(rev.revId, result);
    return result;
  };

  const getSectionCharMap = (rev: Revision): Array<{ charOffset: number; section: string }> => {
    const cached = sectionCharMapCache.get(rev.revId);
    if (cached) return cached;
    const map = buildSectionCharMap(rev.content);
    sectionCharMapCache.set(rev.revId, map);
    return map;
  };

  const parsedCache = new Map<number, ParsedContent>();

  const getParsed = (rev: Revision): ParsedContent => {
    const cached = parsedCache.get(rev.revId);
    if (cached) return cached;
    const result: ParsedContent = {
      sections: sectionDiffer.extractSections(rev.content),
      citations: citationTracker.extractCitations(rev.content),
      wikilinks: extractWikilinks(rev.content),
      categories: extractCategories(rev.content),
      templates: templateTracker.extractTemplates(rev.content),
    };
    parsedCache.set(rev.revId, result);
    return result;
  };

  const [pageMoves, protectionLogs, talkRevs] = await Promise.all([
    client.fetchPageMoves(pageTitle),
    client.fetchProtectionLogs(pageTitle),
    client.fetchTalkRevisions(pageTitle, { direction: "newer", limit: 10 }),
  ]);
  const pageMoveEvents = buildPageMoveEvents(pageMoves);
  events.push(...pageMoveEvents);

  const protectionLogsWithTs = protectionLogs.map((l) => ({
    l,
    ts: new Date(l.timestamp).getTime(),
  }));

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

    const beforeParsed = getParsed(before);
    const afterParsed = getParsed(after);

    const sectionChanges = sectionDiffer.diffSections(beforeParsed.sections, afterParsed.sections);
    const citationChanges = citationTracker.diffCitations(beforeParsed.citations, afterParsed.citations);
    const wikilinkChanges = diffWikilinks(beforeParsed.wikilinks, afterParsed.wikilinks);
    const categoryChanges = diffCategories(beforeParsed.categories, afterParsed.categories);
    const templateChanges = templateTracker.diffTemplates(beforeParsed.templates, afterParsed.templates);

    const isRevRevert = revertDetector.isRevert(after.comment);

    for (const cit of citationChanges) {
      if (cit.type === "unchanged") continue;
      const layer: EvidenceLayer = "observed";
      events.push({
        eventType:
          cit.type === "added" ? "citation_added" : cit.type === "removed" ? "citation_removed" : "citation_replaced",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "body",
        before: isBrief ? "" : (cit.before?.raw ?? ""),
        after: isBrief ? "" : (cit.after?.raw ?? ""),
        deterministicFacts: [{ fact: "citation_changed", detail: `type=${cit.type}` }, ...extraFacts],
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
        deterministicFacts: [{ fact: "wikilink_added", detail: `target=${link}` }, ...extraFacts],
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
        deterministicFacts: [{ fact: "wikilink_removed", detail: `target=${link}` }, ...extraFacts],
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
        deterministicFacts: [{ fact: "category_added", detail: `category=${cat}` }, ...extraFacts],
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
        deterministicFacts: [{ fact: "category_removed", detail: `category=${cat}` }, ...extraFacts],
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
          ...(policyDimension
            ? [
                {
                  fact: "policy_signal",
                  detail: `dimension=${policyDimension} signal=${tpl.template.name.toLowerCase().replace(/\s+/g, "_")}`,
                },
              ]
            : []),
          ...extraFacts,
        ],
        layer,
        timestamp: after.timestamp,
      });
    }

    const paramChangeEvents = buildParamChangeEvents(
      beforeParsed.templates,
      afterParsed.templates,
      before.revId,
      after.revId,
      after.timestamp,
    );
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
        deterministicFacts: [{ fact: "section_changed", detail: `change=${sc.changeType}` }, ...extraFacts],
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

    const fromTs = new Date(before.timestamp).getTime();
    const toTs = new Date(after.timestamp).getTime();
    const protectionLogsInRange = protectionLogsWithTs.filter(({ ts }) => ts > fromTs && ts <= toTs).map(({ l }) => l);
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

    const leadChange = sectionChanges.find((sc) => sc.section === "(lead)" && sc.changeType === "modified");
    if (leadChange) {
      const fromLen = leadChange.fromContent?.length ?? 0;
      const toLen = leadChange.toContent?.length ?? 0;
      const contentMovedOut = fromLen > toLen && toLen < fromLen * 0.5;
      const contentMovedIn = toLen > fromLen && fromLen < toLen * 0.5;

      if (contentMovedOut) {
        const targetSection = sectionChanges.find(
          (sc) => sc.section !== "(lead)" && (sc.changeType === "added" || sc.changeType === "modified"),
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
          (sc) => sc.section !== "(lead)" && (sc.changeType === "removed" || sc.changeType === "modified"),
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

    const beforePlain = getStripped(before);
    const afterPlain = getStripped(after);

    const sentenceSplit = /(?:[.!?]\s+|[。！？؟]\s*)/;
    const beforeSentences = beforePlain.split(sentenceSplit).filter((s) => s.trim().length > 20);
    const afterSentences = afterPlain.split(sentenceSplit).filter((s) => s.trim().length > 20);

    const beforeNorm = beforePlain.toLowerCase().replace(/\s+/g, " ");
    const afterNorm = afterPlain.toLowerCase().replace(/\s+/g, " ");

    const beforeSecMap = getSectionCharMap(before);
    const afterSecMap = getSectionCharMap(after);

    for (const sentence of afterSentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      const foundInBefore = fuzzyFindClaim(trimmed, beforePlain, beforeNorm);
      if (!foundInBefore) {
        const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
        const wasSeenBefore = allSeenSentences.has(normalized);
        const section = findSectionForText(after.content, trimmed, afterPlain, afterSecMap);
        events.push({
          eventType: wasSeenBefore ? "claim_reintroduced" : "claim_first_seen",
          fromRevisionId: before.revId,
          toRevisionId: after.revId,
          section,
          before: "",
          after: isBrief ? "" : trimmed,
          deterministicFacts: [{ fact: "claim_detected", detail: `sentence_length=${trimmed.length}` }, ...extraFacts],
          layer: "observed",
          timestamp: after.timestamp,
        });
      } else {
        const oldLen = foundInBefore.length;
        const newLen = trimmed.length;
        if (Math.abs(newLen - oldLen) > oldLen * 0.2) {
          const section = findSectionForText(after.content, trimmed, afterPlain, afterSecMap);
          const beforeSection = findSectionForText(before.content, foundInBefore, beforePlain, beforeSecMap);
          const changeType = classifyClaimChange(foundInBefore, trimmed, beforeSection, section);
          events.push({
            eventType:
              changeType === "moved"
                ? "claim_moved"
                : changeType === "softened"
                  ? "claim_softened"
                  : changeType === "strengthened"
                    ? "claim_strengthened"
                    : "claim_reworded",
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
      const foundInAfter = fuzzyFindClaim(trimmed, afterPlain, afterNorm);
      if (!foundInAfter) {
        const section = findSectionForText(before.content, trimmed, beforePlain, beforeSecMap);
        events.push({
          eventType: "claim_removed",
          fromRevisionId: before.revId,
          toRevisionId: after.revId,
          section,
          before: isBrief ? "" : trimmed,
          after: "",
          deterministicFacts: [{ fact: "claim_removed", detail: `sentence_length=${trimmed.length}` }, ...extraFacts],
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
    } catch {
      /* prior observation file may not exist yet */
    }

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
  auth?: AuthConfig,
): Promise<{ events: EvidenceEvent[]; revisions: Revision[] }> {
  const content = readFileSync(pagesFile, "utf-8");
  const titles: string[] = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  console.log(`Batch mode: ${titles.length} pages from ${pagesFile}\n`);

  const BATCH_CONCURRENCY = 4;
  const pageResults: BatchPageResult[] = [];
  const allEvents: EvidenceEvent[] = [];

  for (let i = 0; i < titles.length; i += BATCH_CONCURRENCY) {
    const chunk = titles.slice(i, i + BATCH_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (title, j) => {
        const idx = i + j + 1;
        console.log(`--- Page ${idx}/${titles.length}: ${title} ---`);
        const { events } = await runAnalyze(
          title,
          depth,
          fromRevId,
          toRevId,
          fromTimestamp,
          useCache,
          modelConfig,
          apiUrl,
          undefined,
          cacheDir,
          useRouter,
          auth,
        );
        return { pageTitle: title, pageId: 0, eventCount: events.length, events };
      }),
    );
    pageResults.push(...chunkResults);
    for (const r of chunkResults) allEvents.push(...r.events);
  }

  const pages = pageResults;

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
