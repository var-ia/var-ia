const HEDGING_MARKERS: Record<string, string[]> = {
  en: [
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
  ],
  de: [
    "angeblich",
    "möglicherweise",
    "vermutlich",
    "scheinbar",
    "wahrscheinlich",
    "es wird angenommen",
    "es heißt",
    "es heisst",
    "soll",
    "könnte",
    "dürfte",
    "angeblich",
    "mutmaßlich",
    "mutmasslich",
  ],
  fr: [
    "prétendument",
    "soi-disant",
    "présumé",
    "peut-être",
    "possiblement",
    "vraisemblablement",
    "il est suggéré",
    "il paraît",
    "il parait",
    "pourrait",
    "serait",
    "devrait",
  ],
  ja: [
    "かもしれない",
    "だろう",
    "と考えられる",
    "と思われる",
    "らしい",
    "可能性がある",
    "可能性が高い",
    "と考えられている",
  ],
  ar: ["ربما", "قد", "من المحتمل", "يُعتقد أن", "يُقال إن"],
};

const CERTAINTY_MARKERS: Record<string, string[]> = {
  en: [
    "confirmed",
    "established",
    "demonstrated",
    "proven",
    "proved",
    "widely accepted",
    "widely recognized",
    "definitively",
    "conclusively",
    "unequivocally",
    "indisputably",
    "is known to",
    "it is established",
    "it has been shown",
    "there is no doubt",
    "beyond doubt",
  ],
  de: [
    "bewiesen",
    "nachgewiesen",
    "zweifellos",
    "unbestritten",
    "eindeutig",
    "es ist erwiesen",
    "es steht fest",
    "unwiderlegbar",
  ],
  fr: ["prouvé", "démontré", "établi", "incontestablement", "sans aucun doute", "il est démontré", "indubitablement"],
  ja: ["確か", "確実", "明らか", "間違いない", "証明された", "実証された", "間違いなく"],
  ar: ["مؤكد", "بالتأكيد", "لا شك", "من المؤكد", "مُثبت", "مُؤكَّد"],
};

function detectLanguage(text: string): string {
  if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "ja";
  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  if (/[ßäöüÄÖÜ]/.test(text)) return "de";
  if (/[éèêëàâîôûùçœæÉÈÊËÀÂÎÔÛÙÇŒÆ]/.test(text)) return "fr";
  const lower = ` ${text.toLowerCase()} `;
  const deWords = [" der ", " die ", " das ", " und ", " ist ", " nicht ", " ein ", " eine ", " auf "];
  const frWords = [" le ", " la ", " les ", " est ", " pas ", " un ", " une ", " dans ", " sur "];
  const deHits = deWords.filter((w) => lower.includes(w)).length;
  const frHits = frWords.filter((w) => lower.includes(w)).length;
  if (deHits >= 2 && deHits > frHits) return "de";
  if (frHits >= 2) return "fr";
  return "en";
}

function containsAny(text: string, markersSets: Record<string, string[]>): boolean {
  const lang = detectLanguage(text);
  const markers = markersSets[lang] ?? markersSets.en;
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
