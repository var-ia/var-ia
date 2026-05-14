import { describe, it, expect, vi, beforeEach } from "vitest";
import { VariaLoader, variaLoader } from "../loader.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("bun:sqlite", () => ({
  Database: vi.fn(),
}));

describe("VariaLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("sets format to json when path does not end with .db", () => {
      const loader = new VariaLoader({ path: "/data/events.json" });
      expect(loader["format"]).toBe("json");
    });

    it("sets format to sqlite when path ends with .db", () => {
      const loader = new VariaLoader({ path: "/data/events.db" });
      expect(loader["format"]).toBe("sqlite");
    });

    it("respects explicit format option over path inference", () => {
      const loader = new VariaLoader({ path: "/data/events.db", format: "json" });
      expect(loader["format"]).toBe("json");
    });
  });

  describe("load", () => {
    it("reads and parses JSON files", async () => {
      const { readFileSync } = await import("node:fs");
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ events: [{ id: 1 }] }),
      );
      const loader = new VariaLoader({ path: "/data/events.json" });
      const result = await loader.load();
      expect(result).toEqual({ events: [{ id: 1 }] });
    });

    it("rejects on invalid JSON", async () => {
      const { readFileSync } = await import("node:fs");
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("not json{");
      const loader = new VariaLoader({ path: "/data/bad.json" });
      await expect(loader.load()).rejects.toThrow();
    });

    it("queries SQLite when format is sqlite", async () => {
      const { Database } = await import("bun:sqlite");
      const mockClose = vi.fn();
      const mockEventsQuery = vi.fn().mockReturnValue([{ id: 1 }, { id: 2 }]);
      const mockRevisionsQuery = vi.fn().mockReturnValue([{ rev: 101 }]);
      const mockDb = {
        query: vi.fn((sql: string) => {
          if (sql.includes("evidence_events")) return { all: mockEventsQuery };
          if (sql.includes("revisions")) return { all: mockRevisionsQuery };
          return { all: () => [] };
        }),
        close: mockClose,
      };
      (Database as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

      const loader = new VariaLoader({ path: "/data/varia.db" });
      const result = await loader.load();
      expect(result).toEqual({
        events: [{ id: 1 }, { id: 2 }],
        revisions: [{ rev: 101 }],
      });
      expect(mockClose).toHaveBeenCalled();
    });
  });
});

describe("variaLoader factory", () => {
  it("returns a VariaLoader instance", () => {
    const loader = variaLoader({ path: "/data/events.json" });
    expect(loader).toBeInstanceOf(VariaLoader);
  });
});
