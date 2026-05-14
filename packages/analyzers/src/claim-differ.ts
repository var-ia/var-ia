const HEDGING_MARKERS = [
  "may",
  "might",
  "could",
  "would",
  "can",
  "reportedly",
  "allegedly",
  "purportedly",
  "ostensibly",
  "some sources",
  "some experts",
  "it has been suggested",
  "it is believed",
  "it is thought",
  "it is claimed",
  "is believed to",
  "is thought to",
  "is said to",
  "appears to",
  "seems to",
  "suggests that",
  "possibly",
  "presumably",
  "arguably",
];

const CERTAINTY_MARKERS = [
  "confirmed",
  "established",
  "demonstrated",
  "proven",
  "proved",
  "widely accepted",
  "widely recognized",
  "universally acknowledged",
  "definitively",
  "conclusively",
  "unequivocally",
  "indisputably",
  "is known to",
  "it is established",
  "it has been shown",
  "there is no doubt",
  "beyond doubt",
];

function containsAny(text: string, markers: string[]): boolean {
  const lower = text.toLowerCase();
  return markers.some((m) => lower.includes(m));
}

export function classifyClaimChange(
  before: string,
  after: string,
  beforeSection?: string,
  afterSection?: string,
): "softened" | "strengthened" | "moved" | "reworded" {
  const beforeHedging = containsAny(before, HEDGING_MARKERS);
  const afterHedging = containsAny(after, HEDGING_MARKERS);
  const beforeCertainty = containsAny(before, CERTAINTY_MARKERS);
  const afterCertainty = containsAny(after, CERTAINTY_MARKERS);

  if (beforeSection !== undefined && afterSection !== undefined && beforeSection !== afterSection) {
    return "moved";
  }

  const hedgingAdded = !beforeHedging && afterHedging;
  const hedgingRemoved = beforeHedging && !afterHedging;
  const certaintyAdded = !beforeCertainty && afterCertainty;
  const certaintyRemoved = beforeCertainty && !afterCertainty;

  if (hedgingAdded || certaintyRemoved) {
    return "softened";
  }

  if (certaintyAdded || hedgingRemoved) {
    return "strengthened";
  }

  return "reworded";
}
