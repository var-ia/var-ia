import { describe, it, expect, vi, beforeEach } from "vitest";
import { VariaLoader, variaLoader } from "../loader.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("bun:sqlite", () => ({
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires function expression
  Database: vi.fn(function() {
    return { query: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) }), close: vi.fn() };
  }),
}));

describe("VariaLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("sets format to json when path does not end with .db", () => {
      const loader = new VariaLoader({ path: "/data/events.json" });
      expect(loader.format).toBe("json");
    });

    it("sets format to sqlite when path ends with .db", () => {
      const loader = new VariaLoader({ path: "/data/events.db" });
      expect(loader.format).toBe("sqlite");
    });

    it("respects explicit format option over path inference", () => {
      const loader = new VariaLoader({ path: "/data/events.db", format: "json" });
      expect(loader.format).toBe("json");
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

    it("opens SQLite database and queries tables", async () => {
      const loader = new VariaLoader({ path: "/data/varia.db" });
      const result = await loader.load();
      expect(result).toHaveProperty("events");
      expect(result).toHaveProperty("revisions");
    });
  });
});

describe("variaLoader factory", () => {
  it("returns a VariaLoader instance", () => {
    const loader = variaLoader({ path: "/data/events.json" });
    expect(loader).toBeInstanceOf(VariaLoader);
  });
});
