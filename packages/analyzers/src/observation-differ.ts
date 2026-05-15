import type { EvidenceEvent } from "@refract-org/evidence-graph";

export interface ObservationDiff {
  new: EvidenceEvent[];
  resolved: EvidenceEvent[];
  unchanged: EvidenceEvent[];
}

function eventKey(event: EvidenceEvent): string {
  return `${event.eventType}|${event.fromRevisionId}|${event.toRevisionId}|${event.section}`;
}

export function diffObservations(prior: EvidenceEvent[], current: EvidenceEvent[]): ObservationDiff {
  const priorKeys = new Set(prior.map(eventKey));
  const currentKeys = new Set(current.map(eventKey));

  const newEvents = current.filter((e) => !priorKeys.has(eventKey(e)));
  const unchangedEvents = current.filter((e) => priorKeys.has(eventKey(e)));
  const resolvedEvents = prior.filter((e) => !currentKeys.has(eventKey(e)));

  return {
    new: newEvents,
    resolved: resolvedEvents,
    unchanged: unchangedEvents,
  };
}
