import type { EvidenceEvent, EvidenceLayer } from "@refract-org/evidence-graph";

interface PageMoveRecord {
  oldTitle: string;
  newTitle: string;
  timestamp: string;
  revId: number;
  comment: string;
}

export function buildPageMoveEvents(moves: PageMoveRecord[]): EvidenceEvent[] {
  const events: EvidenceEvent[] = [];

  for (const move of moves) {
    const layer: EvidenceLayer = "observed";
    events.push({
      eventType: "page_moved",
      fromRevisionId: 0,
      toRevisionId: move.revId,
      section: "",
      before: move.oldTitle,
      after: move.newTitle,
      deterministicFacts: [
        { fact: "page_moved", detail: `from=${move.oldTitle} to=${move.newTitle} comment=${move.comment}` },
      ],
      layer,
      timestamp: move.timestamp,
    });
  }

  return events;
}
