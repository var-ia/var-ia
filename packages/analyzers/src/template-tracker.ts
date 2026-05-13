import type { TemplateTracker, Template, TemplateChange, TemplateType } from "./index.js";

const TEMPLATE_TYPE_MAP: Record<string, TemplateType> = {
  "citation needed": "citation",
  "cn": "citation",
  "citation": "citation",
  "cite": "citation",
  "fact": "citation",
  "unreferenced": "citation",
  "refimprove": "citation",
  "need citation": "citation",
  "primary sources": "citation",
  "npov": "neutrality",
  "pov": "neutrality",
  "undue": "neutrality",
  "blp": "blp",
  "blp sources": "blp",
  "living persons": "blp",
  "disputed": "dispute",
  "dispute": "dispute",
  "contradict": "dispute",
  "inconsistent": "dispute",
  "cleanup": "cleanup",
  "copy edit": "cleanup",
  "tone": "cleanup",
  "wikify": "cleanup",
  "merge": "cleanup",
  "split": "cleanup",
  "pp": "protection",
  "protected": "protection",
  "pp-protected": "protection",
  "semi-protected": "protection",
};

export const templateTracker: TemplateTracker = {
  extractTemplates(wikitext: string): Template[] {
    const templates: Template[] = [];
    const seen = new Set<string>();
    let i = 0;
    let depth = 0;
    let start = -1;

    while (i < wikitext.length) {
      if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
        if (depth === 0) {
          start = i;
        }
        depth++;
        i += 2;
        continue;
      }
      if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
        depth--;
        if (depth === 0 && start >= 0) {
          const raw = wikitext.slice(start, i + 2);
          const inner = raw.slice(2, -2).trim();
          const firstBar = inner.indexOf("|");
          const firstName = firstBar >= 0 ? inner.slice(0, firstBar).trim() : inner.split("\n")[0].trim();
          const name = firstName.toLowerCase().replace(/\s+/g, " ");

          const key = name;
          if (!seen.has(key)) {
            seen.add(key);
            const params = firstBar >= 0 ? parseParams(inner.slice(firstBar + 1)) : undefined;
            templates.push({
              name: firstName,
              type: classifyTemplate(name),
              params,
            });
          }
        }
        i += 2;
        continue;
      }
      i++;
    }

    return templates;
  },

  diffTemplates(before: Template[], after: Template[]): TemplateChange[] {
    const changes: TemplateChange[] = [];
    const beforeMap = new Map<string, Template>();
    const afterMap = new Map<string, Template>();

    for (const t of before) beforeMap.set(t.name.toLowerCase(), t);
    for (const t of after) afterMap.set(t.name.toLowerCase(), t);

    for (const [name, t] of afterMap) {
      if (!beforeMap.has(name)) {
        changes.push({ type: "added", template: t });
      } else {
        changes.push({ type: "unchanged", template: t });
      }
    }

    for (const [name, t] of beforeMap) {
      if (!afterMap.has(name)) {
        changes.push({ type: "removed", template: t });
      }
    }

    return changes;
  },
};

function classifyTemplate(name: string): TemplateType {
  return TEMPLATE_TYPE_MAP[name] ?? "other";
}

function parseParams(raw: string): Record<string, string> {
  const params: Record<string, string> = {};
  const parts = splitParams(raw);
  let unnamedIndex = 1;

  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex >= 0) {
      params[part.slice(0, eqIndex).trim()] = part.slice(eqIndex + 1).trim();
    } else {
      params[String(unnamedIndex)] = part.trim();
      unnamedIndex++;
    }
  }

  return params;
}

function splitParams(raw: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const ch of raw) {
    if (ch === "{" && raw[current.length + 1] === "{") {
      depth++;
      current += ch;
    } else if (ch === "}" && depth > 0 && raw[current.length - 1] === "{") {
      depth--;
      current += ch;
    } else if (ch === "|" && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}
