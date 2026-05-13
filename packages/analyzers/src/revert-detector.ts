import type { Revision } from "@varia/evidence-graph";
import type { RevertDetector, RevertChain } from "./index.js";

const REVERT_PATTERNS = [
  /\brevert/i,
  /\bundid\s+revision/i,
  /\brvv\b/i,
  /\brollback\b/i,
  /\brestore/i,
  /\[\[WP:ROLLBACK\]\]/i,
];

export const revertDetector: RevertDetector = {
  isRevert(comment: string): boolean {
    return REVERT_PATTERNS.some((pattern) => pattern.test(comment));
  },

  detectRevertChain(revisions: Revision[]): RevertChain[] {
    const chains: RevertChain[] = [];
    const sorted = [...revisions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let i = 0;
    while (i < sorted.length) {
      const rev = sorted[i];
      if (!this.isRevert(rev.comment)) {
        i++;
        continue;
      }

      const existing = chains.find(
        (c) =>
          rev.revId <= c.endRevisionId + 1 && rev.revId >= c.startRevisionId - 1
      );

      if (existing) {
        existing.startRevisionId = Math.min(existing.startRevisionId, rev.revId);
        existing.endRevisionId = Math.max(existing.endRevisionId, rev.revId);
        existing.participants++;
      } else {
        const revertedToMatch = rev.comment.match(/revision\s+(\d+)/i);
        chains.push({
          startRevisionId: rev.revId,
          endRevisionId: rev.revId,
          revertedToRevisionId: revertedToMatch ? parseInt(revertedToMatch[1], 10) : rev.revId - 1,
          participants: 1,
        });
      }

      i++;
    }

    return chains;
  },
};
