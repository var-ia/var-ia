import { classifyClaimChange } from "@var-ia/analyzers";
import type { ClaimState, EvidenceEvent, Revision } from "@var-ia/evidence-graph";
import { createClaimIdentity } from "@var-ia/evidence-graph";
import type { AuthConfig, RevisionOptions } from "@var-ia/ingestion";
import { MediaWikiClient } from "@var-ia/ingestion";
import type { ModelConfig } from "@var-ia/interpreter";
import { createAdapter } from "@var-ia/interpreter";
import { loadCachedRevisions, loadLatestCachedTimestamp, saveRevisions } from "./cache.js";

export async function runClaim(
  pageTitle: string,
  claimText: string,
  useCache = false,
  modelConfig?: ModelConfig,
  apiUrl?: string,
  cacheDir?: string,
  auth?: AuthConfig,
): Promise<void> {
  const client = new MediaWikiClient(apiUrl ? { apiUrl, auth } : auth ? { auth } : undefined);
  console.log(`Tracking claim in "${pageTitle}"...`);
  console.log(`Claim text: "${claimText}"\n`);

  let revisions: Revision[] = [];

  if (useCache) {
    const cached = loadCachedRevisions(pageTitle, 500, cacheDir);
    if (cached.length > 0) {
      console.log(`Loaded ${cached.length} revisions from cache.`);
      revisions = cached;

      const latestTs = loadLatestCachedTimestamp(pageTitle, cacheDir);
      if (latestTs) {
        const deltaOpts: RevisionOptions = { direction: "newer", start: new Date(latestTs) };
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
    revisions = await client.fetchRevisions(pageTitle, { limit: 50, direction: "newer" });
    console.log(`Fetched ${revisions.length} revisions.\n`);

    if (useCache && revisions.length > 0) {
      saveRevisions(revisions, cacheDir);
      console.log(`Cached ${revisions.length} revisions.\n`);
    }
  }

  if (revisions.length === 0) {
    console.log("No revisions found.");
    return;
  }

  const withTs = [...revisions].map((r) => ({ r, ts: new Date(r.timestamp).getTime() }));
  withTs.sort((a, b) => a.ts - b.ts);
  const revs = withTs.map((x) => x.r);

  const identity = createClaimIdentity({
    text: claimText,
    section: "",
    pageTitle,
    pageId: revs[0].pageId,
  });

  const variants: Array<{ revisionId: number; text: string; section: string; observedAt: string }> = [];
  let lastKnownText = "";
  let currentState: ClaimState = "absent";

  for (const rev of revs) {
    const plainText = stripWikitext(rev.content);
    const foundText = fuzzyFindClaim(claimText, plainText);

    if (foundText) {
      if (currentState === "absent") {
        currentState = "emerging";
        console.log(`[${rev.timestamp}] FIRST SEEN (rev ${rev.revId})`);
        console.log(`  State: absent → emerging`);
        console.log(`  Matched text: "${foundText.slice(0, 200)}"`);
      } else if (foundText !== lastKnownText && lastKnownText !== "") {
        const oldLen = lastKnownText.length;
        const newLen = foundText.length;
        if (Math.abs(newLen - oldLen) > oldLen * 0.2) {
          const section = findSectionForText(rev.content, foundText);
          const prevSection = variants.length > 0 ? variants[variants.length - 1].section : section;
          const changeType = classifyClaimChange(lastKnownText, foundText, prevSection, section);
          currentState = "contested";
          console.log(`[${rev.timestamp}] ${changeType.toUpperCase()} (rev ${rev.revId})`);
          console.log(`  State: → contested`);
          console.log(`  Previous: "${lastKnownText.slice(0, 150)}"`);
          console.log(`  Current:  "${foundText.slice(0, 150)}"`);
        }
      }

      lastKnownText = foundText;
      const section = findSectionForText(rev.content, foundText);
      variants.push({
        revisionId: rev.revId,
        text: foundText,
        section,
        observedAt: rev.timestamp,
      });
    } else {
      if (currentState !== "absent" && currentState !== "deleted") {
        currentState = lastKnownText === "" ? "deleted" : "receding";
        console.log(`[${rev.timestamp}] REMOVED (rev ${rev.revId})`);
        console.log(`  State: → ${currentState}`);
        lastKnownText = "";
      }
    }
  }

  if (variants.length === 0) {
    console.log(`\nClaim "${claimText}" not found in any revision of "${pageTitle}".`);
    return;
  }

  if (modelConfig && variants.length >= 2) {
    const adapter = createAdapter(modelConfig);
    const comparisonEvents: EvidenceEvent[] = [];
    for (let i = 1; i < variants.length; i++) {
      comparisonEvents.push({
        eventType: "claim_reworded",
        fromRevisionId: variants[i - 1].revisionId,
        toRevisionId: variants[i].revisionId,
        section: variants[i].section,
        before: variants[i - 1].text,
        after: variants[i].text,
        deterministicFacts: [{ fact: "claim_variant_compared", detail: `pair=${i}` }],
        layer: "observed",
        timestamp: variants[i].observedAt,
      });
    }

    if (comparisonEvents.length > 0) {
      console.log(
        `\nSemantically comparing ${comparisonEvents.length} claim variant pairs with ${modelConfig.provider}...`,
      );
      const interpreted = await adapter.interpret(comparisonEvents);
      for (const ie of interpreted) {
        const conf = ie.modelInterpretation.confidence;
        const label = conf >= 0.7 ? "similar" : conf >= 0.4 ? "moderate change" : "substantial change";
        console.log(
          `[rev ${ie.fromRevisionId}→${ie.toRevisionId}] ${label} (confidence: ${conf.toFixed(2)}) — ${ie.modelInterpretation.semanticChange}`,
        );
      }
    }
  }

  if (currentState !== "absent" && currentState !== "deleted") {
    currentState = "stabilizing";
  }

  console.log(`\n=== Claim Lineage Summary ===`);
  console.log(`Claim ID:    ${identity.claimId}`);
  console.log(`Page:        ${pageTitle}`);
  console.log(`Variants:    ${variants.length}`);
  console.log(`State:       ${currentState}`);
  console.log(`First seen:  ${variants[0].observedAt} (rev ${variants[0].revisionId})`);
  console.log(
    `Last seen:   ${variants[variants.length - 1].observedAt} (rev ${variants[variants.length - 1].revisionId})`,
  );
}

export { runClaim as runClaimCommand };

export function stripWikitext(wikitext: string): string {
  let text = wikitext;
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<ref\b[^>]*\/\s*>/gi, "");
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, "");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/\{\{[^{}]*?\}\}/g, "");
  text = text.replace(/'''(.+?)'''/g, "$1");
  text = text.replace(/''(.+?)''/g, "$1");
  text = text.replace(/\[\[([^\]|]+?)\]\]/g, "$1");
  text = text.replace(/\[\[[^\]]+?\|([^\]]+?)\]\]/g, "$1");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

export function fuzzyFindClaim(claimText: string, plainText: string, preNormalized?: string): string {
  const normalized = claimText.toLowerCase().replace(/\s+/g, " ").trim();
  const searchText = preNormalized ?? plainText.toLowerCase().replace(/\s+/g, " ");

  if (searchText.includes(normalized)) {
    const idx = searchText.indexOf(normalized);
    const start = Math.max(0, idx - 50);
    const end = Math.min(searchText.length, idx + normalized.length + 100);
    return plainText.slice(start, end).trim();
  }

  const words = normalized.split(" ").filter((w) => w.length > 3);
  const matched = words.filter((w) => searchText.includes(w));
  if (matched.length >= words.length * 0.7 && words.length >= 3) {
    return `[partial match: ${matched.length}/${words.length} words]`;
  }

  return "";
}

export function findSectionForText(
  wikitext: string,
  plainText: string,
  preStripped?: string,
  sectionCharMap?: Array<{ charOffset: number; section: string }>,
): string {
  const strippedBase = preStripped ?? stripWikitext(wikitext);
  const stripped = strippedBase.toLowerCase().replace(/\s+/g, " ");
  const targetIdx = stripped.indexOf(plainText.toLowerCase().replace(/\s+/g, " ").trim());

  if (targetIdx < 0) return "(lead)";

  if (sectionCharMap) {
    for (let i = sectionCharMap.length - 1; i >= 0; i--) {
      if (sectionCharMap[i].charOffset <= targetIdx) {
        return sectionCharMap[i].section;
      }
    }
    return "(lead)";
  }

  const headerRegex = /^(=+)\s*([^=]+?)\s*\1$/gm;
  const lines = wikitext.split("\n");
  let currentSection = "(lead)";
  let charCount = 0;

  for (const line of lines) {
    const match = headerRegex.exec(line);
    if (match) {
      if (charCount > targetIdx) return currentSection;
      currentSection = match[2].trim();
    }
    charCount += line.length + 1;
  }

  return currentSection;
}

export function buildSectionCharMap(wikitext: string): Array<{ charOffset: number; section: string }> {
  const lines = wikitext.split("\n");
  const headerRegex = /^(=+)\s*([^=]+?)\s*\1$/;
  const map: Array<{ charOffset: number; section: string }> = [{ charOffset: 0, section: "(lead)" }];
  let charCount = 0;
  for (const line of lines) {
    const match = headerRegex.exec(line);
    if (match) {
      map.push({ charOffset: charCount, section: match[2].trim() });
    }
    charCount += line.length + 1;
  }
  return map;
}
