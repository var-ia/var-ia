import type { Revision } from "@var-ia/evidence-graph";
import { describe, expect, it } from "vitest";
import { correlateTalkRevisions } from "../talk-correlator.js";

function makeArticleRev(revId: number, daysFromNow: number): Revision {
  const d = new Date("2026-01-15T12:00:00Z");
  d.setDate(d.getDate() + daysFromNow);
  return {
    revId,
    pageId: 1,
    pageTitle: "Test",
    timestamp: d.toISOString(),
    comment: "",
    content: "",
    size: 100,
    minor: false,
  };
}

function makeTalkRev(revId: number, daysFromNow: number, comment = ""): Revision {
  const d = new Date("2026-01-15T12:00:00Z");
  d.setDate(d.getDate() + daysFromNow);
  return {
    revId,
    pageId: 2,
    pageTitle: "Talk:Test",
    timestamp: d.toISOString(),
    comment,
    content: "",
    size: 50,
    minor: false,
  };
}

describe("correlateTalkRevisions", () => {
  it("matches a talk revision within the window", () => {
    const articleRevs = [makeArticleRev(100, 0)];
    const talkRevs = [makeTalkRev(200, 1, "discussing source")];

    const events = correlateTalkRevisions(articleRevs, talkRevs);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("talk_page_correlated");
    expect(events[0].fromRevisionId).toBe(100);
    expect(events[0].toRevisionId).toBe(200);
    expect(events[0].deterministicFacts[0].detail).toContain("discussing source");
  });

  it("does not match a talk revision outside the window", () => {
    const articleRevs = [makeArticleRev(100, 0)];
    const talkRevs = [makeTalkRev(200, -20)];

    const events = correlateTalkRevisions(articleRevs, talkRevs);
    expect(events).toHaveLength(0);
  });

  it("matches the closest talk revision for each article revision", () => {
    const articleRevs = [makeArticleRev(100, 0), makeArticleRev(101, 5)];
    const talkRevs = [makeTalkRev(200, 1), makeTalkRev(201, 2), makeTalkRev(202, 6)];

    const events = correlateTalkRevisions(articleRevs, talkRevs);
    expect(events).toHaveLength(2);
    expect(events[0].toRevisionId).toBe(200);
    expect(events[1].toRevisionId).toBe(202);
  });

  it("returns empty when either revision list is empty", () => {
    const rev = makeArticleRev(100, 0);
    expect(correlateTalkRevisions([], [rev])).toHaveLength(0);
    expect(correlateTalkRevisions([rev], [])).toHaveLength(0);
  });
});
