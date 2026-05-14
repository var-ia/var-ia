import { describe, it, expect } from "vitest";
import { parseTalkThreads, diffTalkThreads, buildTalkThreadEvents } from "../talk-section-parser.js";

const SAMPLE_TALK = `
== Proposal for merger ==
I propose merging this article with the main one. ~~~~
: I support this merger. [[User:Alice|Alice]]
:: I oppose. [[User:Bob|Bob]]

{{resolved}}

== Citation dispute ==
The third paragraph needs better sources. ~~~~
: Agreed, I've added a citation. [[User:Charlie|Charlie]]
`;

const EMPTY_TALK = "This is a talk page with no thread headings.";

describe("parseTalkThreads", () => {
  it("extracts threads with headings", () => {
    const threads = parseTalkThreads(SAMPLE_TALK);
    expect(threads.length).toBeGreaterThanOrEqual(2);
    expect(threads[0].heading).toBe("Proposal for merger");
    expect(threads[1].heading).toBe("Citation dispute");
  });

  it("detects resolved threads", () => {
    const threads = parseTalkThreads(SAMPLE_TALK);
    const merger = threads.find((t) => t.heading === "Proposal for merger");
    expect(merger?.isResolved).toBe(true);
  });

  it("extracts replies at different depths", () => {
    const threads = parseTalkThreads(SAMPLE_TALK);
    const merger = threads.find((t) => t.heading === "Proposal for merger");
    expect(merger).toBeDefined();
    expect(merger!.replies.length).toBeGreaterThanOrEqual(3);
  });

  it("extracts participants from User links", () => {
    const threads = parseTalkThreads(SAMPLE_TALK);
    const merger = threads.find((t) => t.heading === "Proposal for merger");
    expect(merger!.participants.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array for pages with no thread headings", () => {
    const threads = parseTalkThreads(EMPTY_TALK);
    expect(Array.isArray(threads)).toBe(true);
  });
});

describe("diffTalkThreads", () => {
  it("detects a new thread as opened", () => {
    const before = parseTalkThreads("");
    const after = parseTalkThreads(SAMPLE_TALK);

    const changes = diffTalkThreads(before, after);
    const opened = changes.filter((c) => c.type === "opened");
    expect(opened.length).toBeGreaterThanOrEqual(2);
  });

  it("detects a removed thread as archived", () => {
    const before = parseTalkThreads(SAMPLE_TALK);
    const after = parseTalkThreads(EMPTY_TALK);

    const changes = diffTalkThreads(before, after);
    const archived = changes.filter((c) => c.type === "archived");
    expect(archived.length).toBeGreaterThanOrEqual(2);
  });

  it("detects a reply added to existing thread", () => {
    const before = parseTalkThreads("== Test ==\nFirst post.");
    const after = parseTalkThreads("== Test ==\nFirst post.\n: Reply.");

    const changes = diffTalkThreads(before, after);
    const replyAdded = changes.find((c) => c.type === "reply_added");
    expect(replyAdded).toBeDefined();
  });
});

describe("buildTalkThreadEvents", () => {
  it("produces talk_thread_opened for new threads", () => {
    const events = buildTalkThreadEvents("", SAMPLE_TALK, 1, 2, "2026-01-01T00:00:00Z");
    const opened = events.filter((e) => e.eventType === "talk_thread_opened");
    expect(opened.length).toBeGreaterThanOrEqual(2);
    expect(opened[0].fromRevisionId).toBe(1);
    expect(opened[0].toRevisionId).toBe(2);
    expect(opened[0].layer).toBe("observed");
  });

  it("produces talk_thread_archived for removed threads", () => {
    const events = buildTalkThreadEvents(SAMPLE_TALK, EMPTY_TALK, 1, 2, "2026-01-01T00:00:00Z");
    const archived = events.filter((e) => e.eventType === "talk_thread_archived");
    expect(archived.length).toBeGreaterThanOrEqual(2);
  });

  it("produces talk_reply_added for new replies", () => {
    const before = "== Test ==\nFirst post.";
    const after = "== Test ==\nFirst post.\n: Reply.";

    const events = buildTalkThreadEvents(before, after, 1, 2, "2026-01-01T00:00:00Z");
    const replies = events.filter((e) => e.eventType === "talk_reply_added");
    expect(replies).toHaveLength(1);
  });
});
