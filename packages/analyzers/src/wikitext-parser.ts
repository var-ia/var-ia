export function sanitizeWikitext(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<ref[^>/]*?>[\s\S]*?<\/ref>/gi, " ")
    .replace(/<ref[^>]*/gi, (match) => (match.endsWith("/>") ? " " : match))
    .replace(/<ref[^>]*\/>/gi, " ")
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\[https?:\/\/[^\s\]]+\s*([^\]]*)\]/g, "$1")
    .replace(/'''/g, "")
    .replace(/''/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface HeadingPosition {
  position: number;
  heading: string;
}

export function extractHeadingMap(wikitext: string): HeadingPosition[] {
  return Array.from(wikitext.matchAll(/^==+\s*(.*?)\s*==+\s*$/gm)).map((match) => ({
    position: match.index ?? 0,
    heading: match[1]?.trim() ?? "",
  }));
}

export function deriveSectionHeading(wikitext: string, position: number): string | null {
  let selected: string | null = null;
  for (const heading of extractHeadingMap(wikitext)) {
    if (heading.position > position) break;
    selected = heading.heading;
  }
  return selected;
}

export function countCitations(wikitext: string): number {
  return Math.max(1, Array.from(wikitext.matchAll(/<ref\b/gi)).length);
}

export function countKeywordMentions(
  wikitext: string,
  phrases: string[],
): { totalMentions: number; matchedPhrases: number } {
  const lowered = wikitext.toLowerCase();
  let totalMentions = 0;
  let matchedPhrases = 0;
  for (const phrase of phrases) {
    const normalized = phrase.trim().toLowerCase();
    if (!normalized) continue;
    let count = 0;
    let fromIndex = 0;
    while (fromIndex < lowered.length) {
      const idx = lowered.indexOf(normalized, fromIndex);
      if (idx === -1) break;
      count++;
      fromIndex = idx + normalized.length;
    }
    totalMentions += count;
    if (count > 0) matchedPhrases += 1;
  }
  return { totalMentions, matchedPhrases };
}

export function extractAnchorSnippet(wikitext: string, phrases: string[], radius = 200): string | null {
  const lowered = wikitext.toLowerCase();
  for (const phrase of phrases) {
    const normalized = phrase.trim().toLowerCase();
    if (!normalized) continue;
    const idx = lowered.indexOf(normalized);
    if (idx === -1) continue;
    const start = Math.max(0, idx - radius);
    const end = Math.min(wikitext.length, idx + normalized.length + radius);
    return wikitext.slice(start, end).trim();
  }
  return null;
}
