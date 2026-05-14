import { describe, it, expect, vi } from "vitest";
import { fetchWikidataId, mapPageToEntity, mapPagesToEntities, wikidataEntityToEvents } from "../wikidata-mapper.js";

describe("fetchWikidataId", () => {
  it("returns null when page has no Wikidata ID", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ query: { pages: { "-1": { title: "NoSuchPage" } } } }),
    });

    const result = await fetchWikidataId("NoSuchPage");
    expect(result).toBeNull();
  });

  it("returns QID when pageprops contains wikibase_item", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: { pages: { "123": { pageprops: { wikibase_item: "Q42" } } } },
      }),
    });

    const result = await fetchWikidataId("Douglas_Adams");
    expect(result).toBe("Q42");
  });

  it("returns null on fetch error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    const result = await fetchWikidataId("SomePage");
    expect(result).toBeNull();
  });
});

describe("mapPageToEntity", () => {
  it("returns empty qid when no Wikidata ID found", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ query: { pages: { "-1": {} } } }),
    });

    const result = await mapPageToEntity("NoPage");
    expect(result.qid).toBe("");
    expect(result.pageTitle).toBe("NoPage");
    expect(result.entity).toBeUndefined();
  });

  it("returns entity when Wikidata ID is found", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: { "123": { pageprops: { wikibase_item: "Q1" } } } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entities: {
            Q1: {
              labels: { en: { value: "Universe" } },
              descriptions: { en: { value: "everything" } },
              aliases: {},
              claims: {
                P31: [
                  {
                    mainsnak: {
                      snaktype: "value",
                      datavalue: { type: "wikibase-item", value: { id: "Q2" } },
                    },
                  },
                ],
                P569: [
                  {
                    mainsnak: {
                      snaktype: "value",
                      datavalue: { type: "time", value: { time: "+1800-01-01T00:00:00Z" } },
                    },
                  },
                ],
              },
            },
          },
        }),
      });

    globalThis.fetch = fetchMock;

    const result = await mapPageToEntity("Universe");
    expect(result.qid).toBe("Q1");
    expect(result.entity?.label).toBe("Universe");
    expect(result.entity?.description).toBe("everything");
    expect(result.entity?.instanceOf).toEqual(["Q2"]);
    expect(Object.keys(result.entity?.claims ?? {})).toHaveLength(2); // P31 (instance of) + P569 (date of birth)
  });
});

describe("mapPagesToEntities", () => {
  it("maps multiple pages concurrently", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ query: { pages: { "-1": {} } } }),
    });

    const results = await mapPagesToEntities(["PageA", "PageB", "PageC"], 2);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.qid === "")).toBe(true);
  });
});

describe("wikidataEntityToEvents", () => {
  it("generates events from entity data", () => {
    const entity = {
      qid: "Q42",
      label: "Test",
      description: "A test entity",
      aliases: [],
      instanceOf: ["Q5"],
      claims: {
        P31: { property: "P31", propertyLabel: "instance of", values: [{ type: "wikibase-item" as const, value: "Q5" }] },
      },
    };

    const events = wikidataEntityToEvents(entity, "Test_Page");
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].eventType).toBe("claim_first_seen");
    expect(events[0].deterministicFacts[0].fact).toBe("wikidata_entity_linked");
  });
});
