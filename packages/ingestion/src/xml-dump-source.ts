import { readFileSync } from "node:fs";
import type { Revision } from "@var-ia/evidence-graph";
import type { RevisionOptions, RevisionSource } from "./index.js";

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(parseInt(n, 10)));
}

function extractPageXml(text: string, title: string): string | null {
  const pattern = /<page>([\s\S]*?)<\/page>/g;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex loop pattern
  while ((match = pattern.exec(text)) !== null) {
    const titleMatch = match[1].match(/<title>(.*?)<\/title>/);
    if (titleMatch && decodeXmlEntities(titleMatch[1]) === title) {
      return match[1];
    }
  }
  return null;
}

function extractRevisions(pageXml: string, pageTitle: string, pageId: number, options?: RevisionOptions): Revision[] {
  const revs: Revision[] = [];
  const re = /<revision>([\s\S]*?)<\/revision>/g;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex loop pattern
  while ((match = re.exec(pageXml)) !== null) {
    const xml = match[1];
    const idMatch = xml.match(/<id>(\d+)<\/id>/);
    const timestampMatch = xml.match(/<timestamp>(.*?)<\/timestamp>/);
    if (!idMatch || !timestampMatch) continue;

    const revId = parseInt(idMatch[1], 10);

    const commentRaw = xml.match(/<comment>(.*?)<\/comment>/);
    const comment = commentRaw ? decodeXmlEntities(commentRaw[1]) : "";

    const textMatch = xml.match(/<text[^>]*>([\s\S]*?)<\/text>/);
    const content = textMatch ? decodeXmlEntities(textMatch[1]) : "";

    const ts = timestampMatch[1];
    if (options?.start && new Date(ts) < options.start) continue;
    if (options?.end && new Date(ts) > options.end) continue;

    revs.push({
      revId,
      pageId,
      pageTitle,
      timestamp: ts,
      comment,
      content,
      size: content.length,
      minor: false,
    });

    if (options?.limit && revs.length >= options.limit) break;
  }

  return revs;
}

export class XmlDumpRevisionSource implements RevisionSource {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async *revisions(pageTitle: string, options?: RevisionOptions): AsyncIterable<Revision> {
    const text = readFileSync(this.filePath, "utf-8");
    const pageXml = extractPageXml(text, pageTitle);
    if (!pageXml) return;

    const idMatch = pageXml.match(/<id>(\d+)<\/id>/);
    const pageId = idMatch ? parseInt(idMatch[1], 10) : 0;

    const revs = extractRevisions(pageXml, pageTitle, pageId, options);
    for (const rev of revs) {
      yield rev;
    }
  }
}
