import type { Revision } from "@var-ia/evidence-graph";
import { describe, expect, it } from "vitest";
import { detectTalkActivitySpikes } from "../talk-activity-detector.js";

function makeTalkRev(revId: number, timestamp: string): Revision {
  return { revId, title: "Talk:Test", timestamp, user: "Editor", comment: "talk", content: "" };
}

function makeArticleRev(revId: number, timestamp: string): Revision {
  return { revId, title: "Test", timestamp, user: "Editor", comment: "edit", content: "" };
}

describe("detectTalkActivitySpikes", () => {
  const today = new Date();
  function dayOffset(offset: number): string {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return `${d.toISOString().slice(0, 10)}T12:00:00Z`;
  }

  it("returns empty for no talk revisions", () => {
    const result = detectTalkActivitySpikes([], [makeArticleRev(1, dayOffset(0))]);
    expect(result.spikes).toHaveLength(0);
    expect(result.movingAverage).toBe(0);
  });

  it("returns empty when insufficient data for moving average", () => {
    const talkRevs = [makeTalkRev(1, dayOffset(-2)), makeTalkRev(2, dayOffset(-1))];
    const result = detectTalkActivitySpikes(talkRevs, []);
    expect(result.spikes).toHaveLength(0);
    expect(result.activityByDay).toHaveLength(2);
  });

  it("detects spike when activity exceeds moving average threshold", () => {
    const talkRevs: Revision[] = [];
    let id = 1;

    for (let d = 4; d >= 1; d--) {
      talkRevs.push(makeTalkRev(id++, dayOffset(-d)));
    }

    // Spike day: 10 edits (exceeds 3x the moving average of ~1)
    for (let e = 0; e < 10; e++) {
      talkRevs.push(makeTalkRev(id++, dayOffset(0)));
    }

    const result = detectTalkActivitySpikes(talkRevs, [], {
      lookbackWindowMs: 30 * 24 * 60 * 60 * 1000,
      spikeFactor: 3.0,
      movingAveragePeriods: 4,
    });

    expect(result.spikes.length).toBeGreaterThanOrEqual(1);
    expect(result.spikes[0].eventType).toBe("talk_activity_spike");
  });

  it("does not flag normal activity as spikes", () => {
    const talkRevs: Revision[] = [];
    let id = 1;

    for (let d = 7; d >= 1; d--) {
      talkRevs.push(makeTalkRev(id++, dayOffset(-d)));
    }

    const result = detectTalkActivitySpikes(talkRevs, [], {
      lookbackWindowMs: 30 * 24 * 60 * 60 * 1000,
      spikeFactor: 3.0,
      movingAveragePeriods: 4,
    });

    expect(result.spikes).toHaveLength(0);
  });

  it("includes nearby article edit count in spike facts", () => {
    const talkRevs: Revision[] = [];
    const articleRevs: Revision[] = [];
    let tid = 1;
    let aid = 1;

    for (let d = 4; d >= 1; d--) {
      talkRevs.push(makeTalkRev(tid++, dayOffset(-d)));
    }

    for (let e = 0; e < 10; e++) {
      talkRevs.push(makeTalkRev(tid++, dayOffset(0)));
    }
    articleRevs.push(makeArticleRev(aid++, dayOffset(0)));

    const result = detectTalkActivitySpikes(talkRevs, articleRevs, {
      lookbackWindowMs: 30 * 24 * 60 * 60 * 1000,
      spikeFactor: 3.0,
      movingAveragePeriods: 4,
    });

    expect(result.spikes.length).toBeGreaterThanOrEqual(1);
    expect(result.spikes[0].deterministicFacts[0].detail).toContain("nearby_article_edits=1");
  });

  it("returns daily activity buckets", () => {
    const talkRevs: Revision[] = [];
    let id = 1;
    talkRevs.push(makeTalkRev(id++, "2024-03-01T00:00:00Z"));
    talkRevs.push(makeTalkRev(id++, "2024-03-01T12:00:00Z"));
    talkRevs.push(makeTalkRev(id++, "2024-03-02T00:00:00Z"));

    const result = detectTalkActivitySpikes(talkRevs, []);
    expect(result.activityByDay).toEqual([
      { date: "2024-03-01", count: 2 },
      { date: "2024-03-02", count: 1 },
    ]);
  });
});
