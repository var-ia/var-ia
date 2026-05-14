import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MediaWikiClient } from "../mediawiki-client.js";

const MOCK_PROTECT_RESPONSE = {
  query: {
    logevents: [
      {
        logid: 100,
        title: "Test",
        timestamp: "2026-01-15T00:00:00Z",
        comment: "semi-protected",
        action: "protect",
      },
      {
        logid: 101,
        title: "Test",
        timestamp: "2026-02-01T00:00:00Z",
        comment: "extended",
        action: "modify",
      },
    ],
  },
};

const MOCK_EMPTY_RESPONSE = { query: { logevents: [] } };

const MOCK_PAGE_INFO_RESPONSE = {
  query: {
    pages: {
      "100": {
        pageid: 100,
        title: "Test",
        revisions: [
          {
            revid: 1,
            parentid: 0,
            timestamp: "2026-01-01T00:00:00Z",
            comment: "first",
            size: 100,
          },
        ],
      },
    },
  },
};

describe("MediaWikiClient", () => {
  let client: MediaWikiClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new MediaWikiClient({ apiUrl: "https://en.wikipedia.org/w/api.php", minDelayMs: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchProtectionLogs returns parsed logs", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_PROTECT_RESPONSE),
    });
    vi.stubGlobal("fetch", mockFetch);

    const logs = await client.fetchProtectionLogs("Test");
    expect(logs).toHaveLength(2);
    expect(logs[0].logId).toBe(100);
    expect(logs[0].action).toBe("protect");
    expect(logs[1].logId).toBe(101);
    expect(logs[1].action).toBe("modify");
  });

  it("fetchProtectionLogs returns empty for no logs", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_EMPTY_RESPONSE),
    });
    vi.stubGlobal("fetch", mockFetch);

    const logs = await client.fetchProtectionLogs("Nonexistent");
    expect(logs).toEqual([]);
  });

  it("revisions async iterator yields revisions", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_PAGE_INFO_RESPONSE),
    });
    vi.stubGlobal("fetch", mockFetch);

    const results: Array<{ revId: number }> = [];
    for await (const rev of client.revisions("Test", { limit: 1 })) {
      results.push(rev);
    }
    expect(results).toHaveLength(1);
    expect(results[0].revId).toBe(1);
  });

  it("revisions returns empty when page is missing", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ query: { pages: { "-1": { missing: "" } } } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const revs: Array<{ revId: number }> = [];
    for await (const rev of client.revisions("MissingPage", { limit: 1 })) {
      revs.push(rev);
    }
    expect(revs).toEqual([]);
  });
});
