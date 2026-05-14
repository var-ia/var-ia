import { describe, it, expect } from "vitest";
import { protectionTracker } from "../protection-tracker.js";
import type { ProtectionLogRecord } from "../protection-tracker.js";

describe("protectionTracker", () => {
  describe("buildState", () => {
    it("builds state from a protection log", () => {
      const logs: ProtectionLogRecord[] = [
        { logId: 1, pageTitle: "Test", timestamp: "2026-01-01T00:00:00Z", comment: "protecting", action: "protect" },
      ];
      const state = protectionTracker.buildState(logs);
      expect(state.size).toBeGreaterThan(0);
    });

    it("returns empty map for empty logs", () => {
      const state = protectionTracker.buildState([]);
      expect(state.size).toBe(0);
    });
  });

  describe("diffState", () => {
    it("detects added protections", () => {
      const before = new Map();
      const after = new Map();
      after.set("Test", { level: "semi", sinceTimestamp: "2026-01-01T00:00:00Z", sinceLogId: 1 });

      const changes = protectionTracker.diffState(before, after);
      const added = changes.filter((c) => c.type === "added");
      expect(added.length).toBeGreaterThanOrEqual(1);
    });

    it("detects removed protections", () => {
      const before = new Map();
      before.set("Test", { level: "semi", sinceTimestamp: "2026-01-01T00:00:00Z", sinceLogId: 1 });
      const after = new Map();

      const changes = protectionTracker.diffState(before, after);
      const removed = changes.filter((c) => c.type === "removed");
      expect(removed.length).toBeGreaterThanOrEqual(1);
    });

    it("returns empty for identical states", () => {
      const state = new Map();
      state.set("Test", { level: "semi", sinceTimestamp: "2026-01-01T00:00:00Z", sinceLogId: 1 });

      expect(protectionTracker.diffState(state, state)).toHaveLength(0);
    });
  });

  describe("findLogsBetween", () => {
    const logs: ProtectionLogRecord[] = [
      { logId: 1, pageTitle: "Test", timestamp: "2026-01-01T00:00:00Z", comment: "first", action: "protect" },
      { logId: 2, pageTitle: "Test", timestamp: "2026-01-15T00:00:00Z", comment: "second", action: "modify" },
      { logId: 3, pageTitle: "Test", timestamp: "2026-02-01T00:00:00Z", comment: "third", action: "unprotect" },
    ];

    it("finds logs within a time range", () => {
      const found = protectionTracker.findLogsBetween(logs, "2026-01-10T00:00:00Z", "2026-01-20T00:00:00Z");
      expect(found).toHaveLength(1);
      expect(found[0].logId).toBe(2);
    });

    it("returns empty for range with no logs", () => {
      const found = protectionTracker.findLogsBetween(logs, "2025-01-01T00:00:00Z", "2025-12-31T00:00:00Z");
      expect(found).toHaveLength(0);
    });

    it("returns empty for empty logs array", () => {
      expect(protectionTracker.findLogsBetween([], "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")).toEqual([]);
    });
  });
});
