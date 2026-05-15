import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefractLoader, refractLoader } from "../loader.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("bun:sqlite", () => ({
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires function expression
  Database: vi.fn(function () {
    return { query: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) }), close: vi.fn() };
  }),
}));

describe("RefractLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("sets format to json when path does not end with .db", () => {
      const loader = new RefractLoader({ path: "/data/events.json" });
      expect(loader.format).toBe("json");
    });

    it("sets format to sqlite when path ends with .db", () => {
      const loader = new RefractLoader({ path: "/data/events.db" });
      expect(loader.format).toBe("sqlite");
    });

    it("respects explicit format option over path inference", () => {
      const loader = new RefractLoader({ path: "/data/events.db", format: "json" });
      expect(loader.format).toBe("json");
    });
  });

  describe("load", () => {
    it("reads and parses JSON files", async () => {
      const { readFileSync } = await import("node:fs");
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify({ events: [{ id: 1 }] }));
      const loader = new RefractLoader({ path: "/data/events.json" });
      const result = await loader.load();
      expect(result).toEqual({ events: [{ id: 1 }] });
    });

    it("rejects on invalid JSON", async () => {
      const { readFileSync } = await import("node:fs");
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("not json{");
      const loader = new RefractLoader({ path: "/data/bad.json" });
      await expect(loader.load()).rejects.toThrow();
    });

    it("opens SQLite database and queries tables", async () => {
      const loader = new RefractLoader({ path: "/data/refract.db" });
      const result = await loader.load();
      expect(result).toHaveProperty("events");
      expect(result).toHaveProperty("revisions");
    });
  });
});

describe("refractLoader factory", () => {
  it("returns a RefractLoader instance", () => {
    const loader = refractLoader({ path: "/data/events.json" });
    expect(loader).toBeInstanceOf(RefractLoader);
  });
});
