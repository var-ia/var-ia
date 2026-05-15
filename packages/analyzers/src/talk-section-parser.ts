import type { EvidenceEvent } from "@refract-org/evidence-graph";

export interface TalkReply {
  depth: number;
  text: string;
  author?: string;
  timestamp?: string;
}

export interface TalkThread {
  heading: string;
  startedAt?: string;
  replies: TalkReply[];
  participants: string[];
  isResolved: boolean;
}

export interface TalkThreadChange {
  type: "opened" | "archived" | "reply_added" | "unchanged";
  thread: TalkThread;
}

export interface TalkParserOptions {
  resolvedPatterns?: RegExp[];
  maxHeaderLevel?: number;
  userPattern?: RegExp;
  timestampPattern?: RegExp;
}

const DEFAULT_RESOLVED_PATTERN = /\{\{(resolved|done|closed|archived)\}\}/i;
const DEFAULT_USER_PATTERN = /\[\[[Uu]ser:([^\]|]+)/;
const DEFAULT_TIMESTAMP_PATTERN = /(\d{1,2}:\d{2},\s+\d{1,2}\s+\w+\s+\d{4})/;
const DEFAULT_MAX_HEADER_LEVEL = 3;

function extractSignatures(text: string, options?: TalkParserOptions): { author?: string; timestamp?: string } {
  const userPattern = options?.userPattern ?? DEFAULT_USER_PATTERN;
  const timestampPattern = options?.timestampPattern ?? DEFAULT_TIMESTAMP_PATTERN;
  const userMatch = text.match(userPattern);
  const tsMatch = text.match(timestampPattern);
  return {
    author: userMatch?.[1],
    timestamp: tsMatch?.[1],
  };
}

export function parseTalkThreads(wikitext: string, options?: TalkParserOptions): TalkThread[] {
  const maxHeaderLevel = options?.maxHeaderLevel ?? DEFAULT_MAX_HEADER_LEVEL;
  const resolvedPatterns = options?.resolvedPatterns ?? [DEFAULT_RESOLVED_PATTERN];
  const threads: TalkThread[] = [];
  const headerRegex = new RegExp(`^(={1,${maxHeaderLevel}})\\s*([^=]+?)\\s*\\1\\s*$`, "m");
  const lines = wikitext.split("\n");
  let currentThread: TalkThread | null = null;

  for (const line of lines) {
    const headerMatch = headerRegex.exec(line);
    if (headerMatch) {
      if (currentThread) {
        threads.push(currentThread);
      }
      currentThread = {
        heading: headerMatch[2].trim(),
        startedAt: undefined,
        replies: [],
        participants: [],
        isResolved: false,
      };
      continue;
    }

    if (!currentThread) continue;

    if (line.trim()) {
      if (resolvedPatterns.some((p) => p.test(line))) {
        currentThread.isResolved = true;
      }

      const indent = line.search(/\S/);
      const depth = indent > 0 ? Math.ceil(indent / 2) + 1 : 1;
      const { author, timestamp } = extractSignatures(line, options);
      const text = line.replace(/^[:*#]+\s*/, "").trim();

      currentThread.replies.push({ depth, text, author, timestamp });
      if (author && !currentThread.participants.includes(author)) {
        currentThread.participants.push(author);
      }
      if (timestamp && !currentThread.startedAt) {
        currentThread.startedAt = timestamp;
      }
    }
  }

  if (currentThread) {
    threads.push(currentThread);
  }

  return threads;
}

export function diffTalkThreads(before: TalkThread[], after: TalkThread[]): TalkThreadChange[] {
  const changes: TalkThreadChange[] = [];
  const beforeMap = new Map(before.map((t) => [t.heading.toLowerCase(), t]));
  const afterMap = new Map(after.map((t) => [t.heading.toLowerCase(), t]));

  for (const [key, thread] of afterMap) {
    const prev = beforeMap.get(key);
    if (!prev) {
      changes.push({ type: "opened", thread });
    } else if (thread.replies.length > prev.replies.length) {
      changes.push({ type: "reply_added", thread });
    } else {
      changes.push({ type: "unchanged", thread });
    }
  }

  for (const [key, thread] of beforeMap) {
    if (!afterMap.has(key)) {
      changes.push({ type: "archived", thread });
    }
  }

  return changes;
}

export function buildTalkThreadEvents(
  beforeWikitext: string,
  afterWikitext: string,
  fromRevId: number,
  toRevId: number,
  timestamp: string,
  options?: TalkParserOptions,
): EvidenceEvent[] {
  const before = parseTalkThreads(beforeWikitext, options);
  const after = parseTalkThreads(afterWikitext, options);
  const changes = diffTalkThreads(before, after);
  const events: EvidenceEvent[] = [];

  for (const change of changes) {
    if (change.type === "unchanged") continue;

    const eventType =
      change.type === "opened"
        ? "talk_thread_opened"
        : change.type === "archived"
          ? "talk_thread_archived"
          : "talk_reply_added";

    events.push({
      eventType: eventType as EvidenceEvent["eventType"],
      fromRevisionId: fromRevId,
      toRevisionId: toRevId,
      section: change.thread.heading || "(unknown)",
      before: "",
      after: change.thread.heading,
      deterministicFacts: [
        {
          fact: `talk_thread_${change.type}`,
          detail: `heading="${change.thread.heading}" participants=${change.thread.participants.length} replies=${change.thread.replies.length} resolved=${change.thread.isResolved}`,
        },
      ],
      layer: "observed",
      timestamp,
    });
  }

  return events;
}
