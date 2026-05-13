export type HeuristicKind =
  | "revert"
  | "vandalism"
  | "major_addition"
  | "major_removal"
  | "sourcing"
  | "cosmetic"
  | "minor"
  | "unknown";

const VANDALISM_PATTERNS = /\b(vandal|vandalism|spam|blanking|test edit)\b/i;
const SOURCING_PATTERNS = /\b(cite|ref|source|reference|citation|add ref|rm ref)\b/i;
const REVERT_PATTERNS = /\b(rv|revert|reverted|undo|undid|rollback|rvv)\b/i;

export function classifyHeuristic(
  comment: string,
  sizeDelta: number,
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

  if (sizeDelta > 2000) {
    return "major_addition";
  }

  if (sizeDelta < -2000) {
    return "major_removal";
  }

  if (Math.abs(sizeDelta) < 20 && !norm) {
    return "cosmetic";
  }

  if (Math.abs(sizeDelta) < 100) {
    return "minor";
  }

  return "unknown";
}
