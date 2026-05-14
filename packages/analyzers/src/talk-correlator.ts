import type { Revision, EvidenceEvent } from "@var-ia/evidence-graph";

const DEFAULT_WINDOW_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export interface TalkCorrelationOptions {
  windowBeforeMs?: number;
  windowAfterMs?: number;
}

export function correlateTalkRevisions(
  articleRevs: Revision[],
  talkRevs: Revision[],
  options?: TalkCorrelationOptions,
): EvidenceEvent[] {
  const windowBefore = options?.windowBeforeMs ?? DEFAULT_WINDOW_BEFORE_MS;
  const windowAfter = options?.windowAfterMs ?? DEFAULT_WINDOW_AFTER_MS;
  const events: EvidenceEvent[] = [];

  if (articleRevs.length === 0 || talkRevs.length === 0) return events;

  const sortedTalk = [...talkRevs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  for (const article of articleRevs) {
    const articleTime = new Date(article.timestamp).getTime();
    const windowStart = articleTime - windowBefore;
    const windowEnd = articleTime + windowAfter;

    let closest: Revision | null = null;
    let closestDelta = Infinity;

    for (const talk of sortedTalk) {
      const talkTime = new Date(talk.timestamp).getTime();
      if (talkTime < windowStart) continue;
      if (talkTime > windowEnd) break;

      const delta = Math.abs(talkTime - articleTime);
      if (delta < closestDelta) {
        closestDelta = delta;
        closest = talk;
      }
    }

    if (closest) {
      const deltaHours = Math.round(closestDelta / (1000 * 60 * 60) * 10) / 10;
      events.push({
        eventType: "talk_page_correlated",
        fromRevisionId: article.revId,
        toRevisionId: closest.revId,
        section: "",
        before: "",
        after: "",
        deterministicFacts: [
          { fact: "talk_page_correlated", detail: `time_delta_hours=${deltaHours} talk_comment=${closest.comment.slice(0, 200)}` },
        ],
        layer: "observed",
        timestamp: closest.timestamp,
      });
    }
  }

  return events;
}
