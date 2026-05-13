import type { Section, SectionChange } from "@wikipedia-provenance/evidence-graph";
import type { SectionDiffer } from "./index.js";

export const sectionDiffer: SectionDiffer = {
  extractSections(wikitext: string): Section[] {
    const sections: Section[] = [];
    const lines = wikitext.split("\n");
    let byteOffset = 0;

    const headerRegex = /^(=+)\s*([^=]+?)\s*\1$/;
    const headerMatches: Array<{
      index: number;
      offset: number;
      level: number;
      title: string;
    }> = [];

    let currentOffset = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = headerRegex.exec(line);
      if (match) {
        headerMatches.push({
          index: i,
          offset: currentOffset,
          level: match[1].length,
          title: match[2].trim(),
        });
      }
      currentOffset += Buffer.byteLength(line, "utf8") + 1; // +1 for newline
    }

    if (headerMatches.length === 0) {
      sections.push({
        title: "",
        level: 1,
        content: wikitext.trim(),
        byteOffset: 0,
      });
      return sections;
    }

    const leadEnd = headerMatches[0].offset;
    const leadContent = wikitext.slice(0, leadEnd).trim();
    if (leadContent) {
      sections.push({
        title: "",
        level: 1,
        content: leadContent,
        byteOffset: 0,
      });
    }

    for (let i = 0; i < headerMatches.length; i++) {
      const header = headerMatches[i];
      const nextOffset = i + 1 < headerMatches.length
        ? headerMatches[i + 1].offset
        : Buffer.byteLength(wikitext, "utf8");
      const headerLine = lines[header.index];
      const headerEnd = header.offset + Buffer.byteLength(headerLine, "utf8") + 1;
      const content = wikitext.slice(headerEnd, nextOffset).trim();

      sections.push({
        title: header.title,
        level: header.level,
        content,
        byteOffset: header.offset,
      });
    }

    return sections;
  },

  diffSections(before: Section[], after: Section[]): SectionChange[] {
    const changes: SectionChange[] = [];
    const beforeByTitle = new Map<string, Section>();
    const afterByTitle = new Map<string, Section>();

    for (const s of before) {
      const key = sectionKey(s);
      beforeByTitle.set(key, s);
    }
    for (const s of after) {
      const key = sectionKey(s);
      afterByTitle.set(key, s);
    }

    const seenAfter = new Set<string>();

    for (const [key, afterSection] of afterByTitle) {
      seenAfter.add(key);
      const beforeSection = beforeByTitle.get(key);
      if (!beforeSection) {
        changes.push({
          section: afterSection.title || "(lead)",
          changeType: "added",
          toContent: afterSection.content,
        });
      } else if (beforeSection.content !== afterSection.content) {
        changes.push({
          section: afterSection.title || "(lead)",
          changeType: "modified",
          fromContent: beforeSection.content,
          toContent: afterSection.content,
        });
      } else {
        changes.push({
          section: afterSection.title || "(lead)",
          changeType: "unchanged",
        });
      }
    }

    for (const [key, beforeSection] of beforeByTitle) {
      if (!seenAfter.has(key)) {
        changes.push({
          section: beforeSection.title || "(lead)",
          changeType: "removed",
          fromContent: beforeSection.content,
        });
      }
    }

    return changes;
  },
};

function sectionKey(s: Section): string {
  return `${s.level}:${s.title.toLowerCase()}`;
}
