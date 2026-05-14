import type { Section, SectionChange } from "@var-ia/evidence-graph";
import type { SectionDiffer } from "./index.js";

export const sectionDiffer: SectionDiffer = {
  extractSections(wikitext: string): Section[] {
    const sections: Section[] = [];
    const lines = wikitext.split("\n");
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
      const nextOffset =
        i + 1 < headerMatches.length ? headerMatches[i + 1].offset : Buffer.byteLength(wikitext, "utf8");
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

export interface SectionEvent {
  revisionId: number;
  timestamp: string;
  eventType: "created" | "modified" | "removed" | "renamed";
  content?: string;
  oldName?: string;
  newName?: string;
}

export interface SectionLineage {
  sectionName: string;
  level: number;
  firstSeenRevisionId: number;
  firstSeenAt: string;
  lastSeenRevisionId?: number;
  lastSeenAt?: string;
  events: SectionEvent[];
  isActive: boolean;
}

export function buildSectionLineage(
  revisions: Array<{ revId: number; timestamp: string; content: string }>,
): SectionLineage[] {
  if (revisions.length === 0) return [];

  const lineages = new Map<string, SectionLineage>();

  const firstSections = sectionDiffer.extractSections(revisions[0].content);
  for (const section of firstSections) {
    const key = sectionKey(section);
    lineages.set(key, {
      sectionName: section.title || "(lead)",
      level: section.level,
      firstSeenRevisionId: revisions[0].revId,
      firstSeenAt: revisions[0].timestamp,
      lastSeenRevisionId: revisions[0].revId,
      lastSeenAt: revisions[0].timestamp,
      events: [
        {
          revisionId: revisions[0].revId,
          timestamp: revisions[0].timestamp,
          eventType: "created",
          content: section.content,
        },
      ],
      isActive: true,
    });
  }

  for (let i = 0; i < revisions.length - 1; i++) {
    const prevRev = revisions[i];
    const currRev = revisions[i + 1];

    const prevSections = sectionDiffer.extractSections(prevRev.content);
    const currSections = sectionDiffer.extractSections(currRev.content);

    const prevByKey = new Map<string, Section>();
    const currByKey = new Map<string, Section>();
    for (const s of prevSections) prevByKey.set(sectionKey(s), s);
    for (const s of currSections) currByKey.set(sectionKey(s), s);

    const prevKeys = new Set(prevByKey.keys());
    const currKeys = new Set(currByKey.keys());

    const removedKeys = [...prevKeys].filter((k) => !currKeys.has(k));
    const addedKeys = [...currKeys].filter((k) => !prevKeys.has(k));

    const renamedFromTo = new Map<string, string>();
    for (const remKey of removedKeys) {
      const remSection = prevByKey.get(remKey)!;
      for (const addKey of addedKeys) {
        if (remSection.content === currByKey.get(addKey)?.content) {
          renamedFromTo.set(remKey, addKey);
          break;
        }
      }
    }

    const renamedToSet = new Set(renamedFromTo.values());

    for (const key of removedKeys) {
      if (renamedFromTo.has(key)) {
        const newKey = renamedFromTo.get(key)!;
        const oldSection = prevByKey.get(key)!;
        const newSection = currByKey.get(newKey)!;
        const lineage = lineages.get(key);
        if (lineage) {
          lineage.events.push({
            revisionId: currRev.revId,
            timestamp: currRev.timestamp,
            eventType: "renamed",
            content: oldSection.content,
            oldName: oldSection.title || "(lead)",
            newName: newSection.title || "(lead)",
          });
          lineage.sectionName = newSection.title || "(lead)";
          lineage.level = newSection.level;
          lineage.lastSeenRevisionId = currRev.revId;
          lineage.lastSeenAt = currRev.timestamp;
          lineage.isActive = true;
          lineages.set(newKey, lineage);
          lineages.delete(key);
        }
      } else {
        const section = prevByKey.get(key)!;
        const lineage = lineages.get(key);
        if (lineage) {
          lineage.events.push({
            revisionId: currRev.revId,
            timestamp: currRev.timestamp,
            eventType: "removed",
            content: section.content,
          });
          lineage.lastSeenRevisionId = prevRev.revId;
          lineage.lastSeenAt = prevRev.timestamp;
          lineage.isActive = false;
        }
      }
    }

    for (const key of addedKeys) {
      if (!renamedToSet.has(key)) {
        const section = currByKey.get(key)!;
        const lineage: SectionLineage = {
          sectionName: section.title || "(lead)",
          level: section.level,
          firstSeenRevisionId: currRev.revId,
          firstSeenAt: currRev.timestamp,
          lastSeenRevisionId: currRev.revId,
          lastSeenAt: currRev.timestamp,
          events: [
            {
              revisionId: currRev.revId,
              timestamp: currRev.timestamp,
              eventType: "created",
              content: section.content,
            },
          ],
          isActive: true,
        };
        lineages.set(key, lineage);
      }
    }

    for (const key of prevKeys) {
      if (currKeys.has(key) && !renamedFromTo.has(key)) {
        const prevSection = prevByKey.get(key)!;
        const currSection = currByKey.get(key)!;
        const lineage = lineages.get(key);
        if (lineage) {
          if (prevSection.content !== currSection.content) {
            lineage.events.push({
              revisionId: currRev.revId,
              timestamp: currRev.timestamp,
              eventType: "modified",
              content: currSection.content,
            });
          }
          lineage.lastSeenRevisionId = currRev.revId;
          lineage.lastSeenAt = currRev.timestamp;
          lineage.isActive = true;
        }
      }
    }
  }

  return [...lineages.values()].sort((a, b) => a.sectionName.localeCompare(b.sectionName));
}

function sectionKey(s: Section): string {
  return `${s.level}:${s.title.toLowerCase()}`;
}
