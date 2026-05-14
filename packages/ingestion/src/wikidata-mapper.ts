import type { EvidenceEvent } from "@var-ia/evidence-graph";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIDATA_ENTITY_API = "https://www.wikidata.org/wiki/Special:EntityData";

export interface WikidataEntity {
  qid: string;
  label: string;
  description: string;
  aliases: string[];
  instanceOf: string[];
  claims: Record<string, WikidataClaim>;
}

export interface WikidataClaim {
  property: string;
  propertyLabel: string;
  values: WikidataValue[];
}

export interface WikidataValue {
  type: "wikibase-item" | "string" | "time" | "quantity" | "url";
  value: string;
}

export interface PageToEntityMap {
  pageTitle: string;
  qid: string;
  entity?: WikidataEntity;
}

export async function fetchWikidataId(pageTitle: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    prop: "pageprops",
    titles: pageTitle,
    format: "json",
    origin: "*",
  });
  const url = `${WIKIPEDIA_API}?${params}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const data = (await res.json()) as WikipediaQueryResponse;
  const pages = data.query?.pages;
  if (!pages) return null;
  for (const id of Object.keys(pages)) {
    if (id === "-1") continue;
    return pages[id].pageprops?.wikibase_item ?? null;
  }
  return null;
}

export async function fetchWikidataEntity(qid: string): Promise<WikidataEntity | null> {
  const url = `${WIKIDATA_ENTITY_API}/${encodeURIComponent(qid)}.json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const data = (await res.json()) as WikidataEntityResponse;
  const entity = data.entities?.[qid];
  if (!entity) return null;

  return {
    qid,
    label: entity.labels?.en?.value ?? qid,
    description: entity.descriptions?.en?.value ?? "",
    aliases: Object.values(entity.aliases?.en ?? {}).map((a) => a.value),
    instanceOf: extractInstanceOf(entity),
    claims: extractClaims(entity),
  };
}

export async function mapPageToEntity(pageTitle: string): Promise<PageToEntityMap> {
  const qid = await fetchWikidataId(pageTitle);
  if (!qid) return { pageTitle, qid: "" };
  const entity = await fetchWikidataEntity(qid);
  return { pageTitle, qid, entity: entity ?? undefined };
}

export async function mapPagesToEntities(
  pageTitles: string[],
  concurrency = 3,
): Promise<PageToEntityMap[]> {
  const results: PageToEntityMap[] = [];
  for (let i = 0; i < pageTitles.length; i += concurrency) {
    const batch = pageTitles.slice(i, i + concurrency);
    const mapped = await Promise.all(batch.map((title) => mapPageToEntity(title)));
    results.push(...mapped);
  }
  return results;
}

export function wikidataEntityToEvents(entity: WikidataEntity, _pageTitle: string): EvidenceEvent[] {
  const events: EvidenceEvent[] = [];
  const props = Object.keys(entity.claims).join(", ");
  const instanceOf = entity.instanceOf.join(", ");

  events.push({
    eventType: "claim_first_seen",
    fromRevisionId: 0,
    toRevisionId: 0,
    section: "",
    before: "",
    after: `Wikidata entity: ${entity.label}`,
    deterministicFacts: [
      { fact: "wikidata_entity_linked", detail: `qid=${entity.qid} label=${entity.label}` },
    ],
    layer: "observed",
    timestamp: new Date().toISOString(),
  });

  if (instanceOf) {
    events.push({
      eventType: "category_added",
      fromRevisionId: 0,
      toRevisionId: 0,
      section: "",
      before: "",
      after: instanceOf,
      deterministicFacts: [
        { fact: "wikidata_instance_of", detail: `types=${instanceOf} properties=${props}` },
      ],
      layer: "observed",
      timestamp: new Date().toISOString(),
    });
  }

  return events;
}

interface WikipediaQueryResponse {
  query?: {
    pages?: Record<string, { pageprops?: { wikibase_item?: string } }>;
  };
}

interface WikidataEntityData {
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  aliases?: Record<string, Array<{ value: string }>>;
  claims?: Record<string, Array<WikidataStatement>>;
}

interface WikidataStatement {
  mainsnak?: {
    snaktype: string;
    datavalue?: {
      type: string;
      value: unknown;
    };
    datatype?: string;
  };
}

interface WikidataEntityResponse {
  entities?: Record<string, WikidataEntityData>;
}

function extractInstanceOf(entity: WikidataEntityData | undefined): string[] {
  const p31 = entity?.claims?.P31;
  if (!p31) return [];
  return p31
    .filter((c: WikidataStatement) => c.mainsnak?.snaktype === "value" && c.mainsnak?.datavalue?.type === "wikibase-item")
    .map((c: WikidataStatement) => {
      const dt = c.mainsnak?.datavalue;
      if (!dt || dt.type !== "wikibase-item") return "";
      return (dt.value as { id: string }).id;
    })
    .filter(Boolean);
}

function extractClaims(entity: WikidataEntityData | undefined): Record<string, WikidataClaim> {
  const result: Record<string, WikidataClaim> = {};
  if (!entity?.claims) return result;
  for (const [prop, statements] of Object.entries(entity.claims)) {
    const values: WikidataValue[] = [];
    for (const stmt of statements) {
      if (stmt.mainsnak?.snaktype !== "value" || !stmt.mainsnak?.datavalue) continue;
      const dt = stmt.mainsnak.datavalue;
      switch (dt.type) {
        case "wikibase-item":
          values.push({ type: "wikibase-item", value: (dt.value as { id: string }).id });
          break;
        case "string":
          values.push({ type: "string", value: dt.value as string });
          break;
        case "time":
          values.push({ type: "time", value: (dt.value as { time: string }).time });
          break;
        case "quantity":
          values.push({ type: "quantity", value: String((dt.value as { amount: string }).amount) });
          break;
        case "url":
          values.push({ type: "url", value: dt.value as string });
          break;
      }
    }
    if (values.length > 0) {
      result[prop] = { property: prop, propertyLabel: prop, values };
    }
  }
  return result;
}
