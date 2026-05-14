import { describe, it, expect, vi } from "vitest";

vi.mock("bun:sqlite", () => {
  class MockDB { run() {} query() { return { all: () => [], get: () => null }; } prepare() { return { run: () => {} }; } transaction(fn: () => void) { return fn; } close() {} }
  return { Database: MockDB };
});

import { parseFlag } from "../index.js";

describe("parseFlag", () => {
  it("parses --flag value style", () => {
    expect(parseFlag(["--depth", "detailed"], "depth")).toBe("detailed");
  });

  it("parses --flag=value style", () => {
    expect(parseFlag(["--depth=forensic"], "depth")).toBe("forensic");
  });

  it("returns undefined for unknown flag", () => {
    expect(parseFlag(["--depth", "brief"], "unknown")).toBeUndefined();
  });

  it("returns undefined when flag is last arg (no value)", () => {
    expect(parseFlag(["--depth"], "depth")).toBeUndefined();
  });

  it("handles mixed flag styles", () => {
    const args = ["--depth", "brief", "--model=openai", "--cache"];
    expect(parseFlag(args, "depth")).toBe("brief");
    expect(parseFlag(args, "model")).toBe("openai");
    expect(parseFlag(args, "cache")).toBeUndefined();
  });

  it("returns first value for duplicate flags", () => {
    const args = ["--depth", "brief", "--depth", "forensic"];
    expect(parseFlag(args, "depth")).toBe("brief");
  });
});
