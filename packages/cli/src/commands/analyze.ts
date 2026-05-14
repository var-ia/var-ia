import { MediaWikiClient } from "@var-ia/ingestion";
import { sectionDiffer, citationTracker, revertDetector, templateTracker } from "@var-ia/analyzers";
import type { TemplateType } from "@var-ia/analyzers";
import type { EvidenceEvent, EvidenceLayer, Revision } from "@var-ia/evidence-graph";
import { createAdapter } from "@var-ia/interpreter";
import type { ModelConfig } from "@var-ia/interpreter";
import { loadCachedRevisions, saveRevisions } from "./cache.js";

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
  useCache = false,
  modelConfig?: ModelConfig,
): Promise<EvidenceEvent[]> {
  const client = new MediaWikiClient();
  console.log(`Analyzing "${pageTitle}" at depth: ${depth}...`);

  let revisions: Revision[] = [];

  if (useCache) {
    const cached = loadCachedRevisions(pageTitle, 20);
    if (cached.length > 0) {
      console.log(`Loaded ${cached.length} revisions from cache.`);
      revisions = cached;
    }
  }

  if (revisions.length === 0) {
    console.log(`Fetching revisions from Wikipedia...`);
    const options: { limit?: number; direction?: "newer" | "older" } = { limit: 20, direction: "newer" };
    void fromRevId;
    revisions = await client.fetchRevisions(pageTitle, options);
    console.log(`Fetched ${revisions.length} revisions.`);

    if (useCache && revisions.length > 0) {
      saveRevisions(revisions);
      console.log(`Cached ${revisions.length} revisions.`);
    }
  }

  if (revisions.length < 2) {
    console.log("Need at least 2 revisions to analyze.");
    return [];
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
      const policyDimension = templateTypeToPolicyDimension(tpl.template.type);
      const layer: EvidenceLayer = policyDimension ? "policy_coded" : "observed";
      events.push({
        eventType: tpl.type === "added" ? "template_added" : "template_removed",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "body",
        before: "",
        after: tpl.template.name,
        deterministicFacts: [
          { fact: "template_changed", detail: `name=${tpl.template.name} type=${tpl.type}` },
          ...(policyDimension ? [{ fact: "policy_signal", detail: `dimension=${policyDimension} signal=${tpl.template.name.toLowerCase().replace(/\s+/g, "_")}` }] : []),
        ],
        layer,
        timestamp: after.timestamp,
      });
    }

    for (const sc of sectionChanges) {
      if (sc.changeType === "unchanged") continue;
      events.push({
        eventType: "section_reorganized",
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
          { fact: "policy_signal", detail: "dimension=edit_warring signal=revert_detected" },
        ],
        layer: "policy_coded",
        timestamp: after.timestamp,
      });
    }
  }

  if (modelConfig && events.length > 0) {
    const adapter = createAdapter(modelConfig);
    console.log(`Interpreting ${events.length} events with ${modelConfig.provider}...`);
    const interpreted = await adapter.interpret(events);
    for (let i = 0; i < interpreted.length; i++) {
      interpreted[i].layer = events[i].layer;
    }
    console.log("Interpretation complete.");
    return interpreted;
  }

  return events;
}
