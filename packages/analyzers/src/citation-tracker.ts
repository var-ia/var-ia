import type { CitationTracker, CitationRef, CitationChange } from "./index.js";

export const citationTracker: CitationTracker = {
  extractCitations(wikitext: string): CitationRef[] {
    const refs: CitationRef[] = [];
    const seen = new Set<string>();

    const refRegex = /<ref\b([^>]*?)>(.*?)<\/ref\s*>/gs;
    let match: RegExpExecArray | null;

    while ((match = refRegex.exec(wikitext)) !== null) {
      const attrs = match[1];
      const content = match[2].trim();

      const nameMatch = attrs.match(/name\s*=\s*["']?([^"'\s>]+)/i);
      const urlMatch = content.match(/url\s*=\s*([^\s|}\]]+)/i);
      const titleMatch = content.match(/title\s*=\s*([^|}\]]+?)(?:\s*[|}\]])/i);

      const raw = match[0];
      const key = nameMatch ? nameMatch[1] : raw;

      if (seen.has(key)) continue;
      seen.add(key);

      refs.push({
        refName: nameMatch?.[1],
        url: urlMatch ? urlMatch[1].trim() : undefined,
        title: titleMatch ? titleMatch[1].trim() : undefined,
        raw,
      });
    }

    const selfClosingRegex = /<ref\b([^>]*?)\/\s*>/g;
    while ((match = selfClosingRegex.exec(wikitext)) !== null) {
      const attrs = match[1];
      const nameMatch = attrs.match(/name\s*=\s*["']?([^"'\s>]+)/i);
      if (!nameMatch) continue;

      const key = nameMatch[1];
      if (seen.has(key)) continue;
      seen.add(key);

      refs.push({
        refName: key,
        raw: match[0],
      });
    }

    return refs;
  },

  diffCitations(before: CitationRef[], after: CitationRef[]): CitationChange[] {
    const changes: CitationChange[] = [];
    const beforeMap = indexByKey(before);
    const afterMap = indexByKey(after);

    for (const [key, afterRef] of afterMap) {
      const beforeRef = beforeMap.get(key);
      if (!beforeRef) {
        changes.push({ type: "added", after: afterRef });
      } else if (beforeRef.raw !== afterRef.raw) {
        changes.push({ type: "replaced", before: beforeRef, after: afterRef });
      } else {
        changes.push({ type: "unchanged", after: afterRef });
      }
    }

    for (const [key, beforeRef] of beforeMap) {
      if (!afterMap.has(key)) {
        changes.push({ type: "removed", before: beforeRef });
      }
    }

    return changes;
  },
};

function indexByKey(refs: CitationRef[]): Map<string, CitationRef> {
  const map = new Map<string, CitationRef>();
  for (const ref of refs) {
    const key = ref.refName ?? ref.raw;
    map.set(key, ref);
  }
  return map;
}
