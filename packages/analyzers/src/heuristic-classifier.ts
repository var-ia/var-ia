export type HeuristicKind =
  | "revert"
  | "vandalism"
  | "major_addition"
  | "major_removal"
  | "sourcing"
  | "cosmetic"
  | "minor"
  | "unknown";

export interface HeuristicOptions {
  majorAdditionThreshold?: number;
  majorRemovalThreshold?: number;
  cosmeticThreshold?: number;
  minorThreshold?: number;
}

const VANDALISM_PATTERNS = /\b(vandal|vandalism|spam|blanking|test edit)\b/i;
const SOURCING_PATTERNS = /\b(cite|ref|source|reference|citation|add ref|rm ref)\b/i;
const REVERT_PATTERNS = /\b(rv|revert|reverted|undo|undid|rollback|rvv)\b/i;

const DEFAULT_MAJOR_ADDITION = 2000;
const DEFAULT_MAJOR_REMOVAL = -2000;
const DEFAULT_COSMETIC = 20;
const DEFAULT_MINOR = 100;

export function classifyHeuristic(
  comment: string,
  sizeDelta: number,
  options?: HeuristicOptions,
): HeuristicKind {
  const norm = comment.toLowerCase().trim();

  if (REVERT_PATTERNS.test(norm)) {
    return "revert";
  }

  if (VANDALISM_PATTERNS.test(norm)) {
    return "vandalism";
  }

  if (SOURCING_PATTERNS.test(norm)) {
    return "sourcing";
  }

  if (sizeDelta > (options?.majorAdditionThreshold ?? DEFAULT_MAJOR_ADDITION)) {
    return "major_addition";
  }

  if (sizeDelta < (options?.majorRemovalThreshold ?? DEFAULT_MAJOR_REMOVAL)) {
    return "major_removal";
  }

  if (Math.abs(sizeDelta) < (options?.cosmeticThreshold ?? DEFAULT_COSMETIC) && !norm) {
    return "cosmetic";
  }

  if (Math.abs(sizeDelta) < (options?.minorThreshold ?? DEFAULT_MINOR)) {
    return "minor";
  }

  return "unknown";
}
