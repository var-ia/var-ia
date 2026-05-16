export type InferenceBoundary = "revert" | "sentence_similarity" | "heuristic" | "template_signal" | "activity_spike";

export interface InferenceRequest {
  boundary: InferenceBoundary;
  input: Record<string, unknown>;
}

export interface InferenceResult {
  boundary: InferenceBoundary;
  output: Record<string, unknown>;
  confidence?: number;
  source: "model" | "default";
}

export interface RevertInput {
  comment: string;
}

export interface RevertOutput {
  isRevert: boolean;
  rationale?: string;
}

export interface SentenceSimilarityInput {
  before: string;
  after: string;
}

export interface SentenceSimilarityOutput {
  isSameClaim: boolean;
  matchRatio: number;
  rationale?: string;
}

export interface HeuristicInput {
  comment: string;
  sizeDelta: number;
}

export interface HeuristicOutput {
  kind: string;
  rationale?: string;
}

export interface TemplateSignalInput {
  templateName: string;
}

export interface TemplateSignalOutput {
  signalType: string;
  rationale?: string;
}

export interface ActivitySpikeInput {
  dailyCounts: Record<string, number>;
  movingAverage: number;
  threshold: number;
  candidateDay: string;
}

export interface ActivitySpikeOutput {
  isSpike: boolean;
  rationale?: string;
}

export function buildInferencePrompt(boundary: InferenceBoundary, input: Record<string, unknown>): string {
  switch (boundary) {
    case "revert": {
      const i = input as unknown as RevertInput;
      return [
        `Does this edit comment indicate a revert? Answer only "yes" or "no".`,
        ``,
        `Edit comment: ${i.comment}`,
      ].join("\n");
    }
    case "sentence_similarity": {
      const i = input as unknown as SentenceSimilarityInput;
      return [
        `Are these two sentences the same claim? Answer only "yes" or "no".`,
        ``,
        `Before: ${i.before}`,
        `After:  ${i.after}`,
      ].join("\n");
    }
    case "heuristic": {
      const i = input as unknown as HeuristicInput;
      return [
        `Classify this edit by type. Answer with a single word: revert, vandalism, sourcing, major_addition, major_removal, cosmetic, minor, or unknown.`,
        ``,
        `Edit comment: ${i.comment}`,
        `Size change: ${i.sizeDelta} bytes`,
      ].join("\n");
    }
    case "template_signal": {
      const i = input as unknown as TemplateSignalInput;
      return [
        `What policy signal does this Wikipedia template represent? Answer with a single word: citation, neutrality, blp, dispute, cleanup, protection, or other.`,
        ``,
        `Template: {{${i.templateName}}}`,
      ].join("\n");
    }
    case "activity_spike": {
      const i = input as unknown as ActivitySpikeInput;
      return [
        `Is this day's talk page activity a meaningful spike, or is it normal variation? Answer only "yes" or "no".`,
        ``,
        `Day: ${i.candidateDay}`,
        `Edits on this day: ${i.dailyCounts[i.candidateDay] ?? 0}`,
        `Moving average: ${i.movingAverage.toFixed(1)}`,
        `Threshold (3x moving average): ${i.threshold.toFixed(1)}`,
      ].join("\n");
    }
  }
}

export function parseInferenceResponse(
  boundary: InferenceBoundary,
  text: string,
  _input: Record<string, unknown>,
): InferenceResult {
  const cleaned = text.trim().toLowerCase();
  const confidence =
    cleaned.includes("yes") ||
    cleaned.match(
      /^(revert|vandalism|sourcing|major_addition|major_removal|cosmetic|minor|unknown|citation|neutrality|blp|dispute|cleanup|protection|other)/,
    )
      ? 0.85
      : 0.5;

  let output: Record<string, unknown>;
  switch (boundary) {
    case "revert":
      output = { isRevert: cleaned.startsWith("y") };
      break;
    case "sentence_similarity":
      output = { isSameClaim: cleaned.startsWith("y"), matchRatio: cleaned.startsWith("y") ? 0.9 : 0.2 };
      break;
    case "heuristic": {
      const kind =
        ["revert", "vandalism", "sourcing", "major_addition", "major_removal", "cosmetic", "minor"].find((k) =>
          cleaned.includes(k),
        ) ?? "unknown";
      output = { kind };
      break;
    }
    case "template_signal": {
      const signalType =
        ["citation", "neutrality", "blp", "dispute", "cleanup", "protection"].find((s) => cleaned.includes(s)) ??
        "other";
      output = { signalType };
      break;
    }
    case "activity_spike":
      output = { isSpike: cleaned.startsWith("y") };
      break;
  }

  return { boundary, output, confidence, source: "model" };
}
