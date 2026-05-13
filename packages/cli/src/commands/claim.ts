import { MediaWikiClient } from "@wikipedia-provenance/ingestion";
import { createClaimIdentity } from "@wikipedia-provenance/evidence-graph";
import type { ClaimState, Revision } from "@wikipedia-provenance/evidence-graph";
import { loadCachedRevisions, saveRevisions } from "./cache.js";

export async function runClaim(
  pageTitle: string,
  claimText: string,
  useCache = false,
): Promise<void> {
  const client = new MediaWikiClient();
  console.log(`Tracking claim in "${pageTitle}"...`);
  console.log(`Claim text: "${claimText}"\n`);

  let revisions: Revision[] = [];

  if (useCache) {
    const cached = loadCachedRevisions(pageTitle, 50);
    if (cached.length > 0) {
      console.log(`Loaded ${cached.length} revisions from cache.`);
      revisions = cached;
    }
  }

  if (revisions.length === 0) {
    revisions = await client.fetchRevisions(pageTitle, { limit: 50, direction: "newer" });
    console.log(`Fetched ${revisions.length} revisions.\n`);

    if (useCache && revisions.length > 0) {
      saveRevisions(revisions);
      console.log(`Cached ${revisions.length} revisions.\n`);
    }
  }

  if (revisions.length === 0) {
    console.log("No revisions found.");
    return;
  }

  const sortedRevs = [...revisions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const identity = createClaimIdentity({
    text: claimText,
    section: "",
    pageTitle,
    pageId: sortedRevs[0].pageId,
  });

  const variants: Array<{ revisionId: number; text: string; section: string; observedAt: string }> = [];
  let lastKnownText = "";
  let currentState: ClaimState = "absent";

  for (const rev of sortedRevs) {
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
          currentState = "contested";
          console.log(`[${rev.timestamp}] REWORDED (rev ${rev.revId})`);
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

  if (currentState !== "absent" && currentState !== "deleted") {
    currentState = "stabilizing";
  }

  console.log(`\n=== Claim Lineage Summary ===`);
  console.log(`Claim ID:    ${identity.claimId}`);
  console.log(`Page:        ${pageTitle}`);
  console.log(`Variants:    ${variants.length}`);
  console.log(`State:       ${currentState}`);
  console.log(`First seen:  ${variants[0].observedAt} (rev ${variants[0].revisionId})`);
  console.log(`Last seen:   ${variants[variants.length - 1].observedAt} (rev ${variants[variants.length - 1].revisionId})`);
}

export { runClaim as runClaimCommand };

function stripWikitext(wikitext: string): string {
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

function fuzzyFindClaim(claimText: string, plainText: string): string {
  const normalized = claimText.toLowerCase().replace(/\s+/g, " ").trim();
  const searchText = plainText.toLowerCase().replace(/\s+/g, " ");

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

function findSectionForText(wikitext: string, plainText: string): string {
  const headerRegex = /^(=+)\s*([^=]+?)\s*\1$/gm;
  const lines = wikitext.split("\n");
  let currentSection = "(lead)";
  let charCount = 0;

  const stripped = stripWikitext(wikitext).toLowerCase().replace(/\s+/g, " ");
  const targetIdx = stripped.indexOf(plainText.toLowerCase().replace(/\s+/g, " ").trim());

  if (targetIdx < 0) return currentSection;

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
