import type { EvidenceEvent } from "@var-ia/evidence-graph";

const isTTY = process.stdout.isTTY;
const noColor = process.env.NO_COLOR !== undefined;
const forceColor = process.env.FORCE_COLOR !== undefined;
const useColor = (isTTY && !noColor) || forceColor;

function ansi(code: number) {
  return (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
}

export const bold = ansi(1);
export const dim = ansi(2);
export const red = ansi(31);
export const green = ansi(32);
export const yellow = ansi(33);
export const blue = ansi(34);
export const cyan = ansi(36);
export const gray = ansi(90);

export function heading(text: string): string {
  const bar = "─".repeat(Math.min(50, text.length + 4));
  return `\n${cyan(bar)}\n  ${bold(text)}\n${cyan(bar)}`;
}

export function eventIcon(eventType: string): string {
  if (eventType.startsWith("citation_")) return yellow("◆");
  if (eventType.startsWith("template_")) return cyan("◇");
  if (eventType.startsWith("sentence_")) return green("●");
  if (eventType === "revert_detected") return red("◉");
  if (eventType.startsWith("section_")) return gray("○");
  if (eventType.startsWith("category_")) return dim("△");
  if (eventType.startsWith("wikilink_")) return blue("◇");
  if (eventType === "protection_changed") return red("⬡");
  return gray("·");
}

export function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    citation_added: "citation added",
    citation_removed: "citation removed",
    citation_replaced: "citation replaced",
    template_added: "template added",
    template_removed: "template removed",
    template_parameter_changed: "param changed",
    section_reorganized: "section changed",
    sentence_first_seen: "sentence introduced",
    sentence_removed: "sentence removed",
    sentence_reintroduced: "sentence reintroduced",
    wikilink_added: "wikilink added",
    wikilink_removed: "wikilink removed",
    category_added: "category added",
    category_removed: "category removed",
    revert_detected: "revert detected",
    protection_changed: "protection changed",
    lead_promotion: "lead promoted",
    lead_demotion: "lead demoted",
    talk_page_correlated: "talk page correlated",
    talk_thread_opened: "talk thread opened",
    talk_thread_archived: "talk thread archived",
    talk_reply_added: "talk reply added",
    talk_activity_spike: "talk activity spike",
    edit_cluster_detected: "edit cluster detected",
  };
  return labels[eventType] ?? eventType.replace(/_/g, " ");
}

export function formatEvent(event: EvidenceEvent): string {
  const icon = eventIcon(event.eventType);
  const label = eventLabel(event.eventType);
  const rev = dim(`(rev ${event.fromRevisionId}\u2192${event.toRevisionId})`);
  let line = `  ${icon} ${bold(label)} ${rev}`;

  if (event.section) {
    line += ` ${gray(`[${event.section}]`)}`;
  }

  const detail = event.deterministicFacts
    .filter((f) => f.fact !== "full_wikitext_before" && f.fact !== "full_wikitext_after")
    .map((f) => (f.detail ? f.detail : f.fact))
    .join(", ");
  if (detail) {
    line += `\n    ${dim(detail)}`;
  }

  if (event.modelInterpretation) {
    const conf = event.modelInterpretation.confidence;
    const confColor = conf >= 0.7 ? green : conf >= 0.4 ? yellow : red;
    line += `\n    ${dim("\u21b3")} ${event.modelInterpretation.semanticChange} ${gray(`(${confColor(conf.toFixed(2))})`)}`;
    if (event.modelInterpretation.policyDimension) {
      line += ` ${gray(`policy: ${event.modelInterpretation.policyDimension}`)}`;
    }
  }

  return line;
}

export function status(message: string): string {
  return dim(`\u2502 ${message}`);
}

export function success(message: string): string {
  return `${green("\u2714")} ${message}`;
}

export function fail(message: string): string {
  return `${red("\u2718")} ${message}`;
}

export function table(headers: string[], rows: string[][], align: ("left" | "right")[] = []): string {
  const colWidths = headers.map((h, i) => {
    const dataWidths = rows.map((r) => (r[i] ?? "").length);
    return Math.max(h.length, ...dataWidths);
  });

  const pad = (text: string, width: number, a: "left" | "right") =>
    a === "right" ? text.padStart(width) : text.padEnd(width);

  const sep = colWidths.map((w) => "\u2500".repeat(w + 2)).join("\u253c");

  const headerRow = bold(headers.map((h, i) => pad(h, colWidths[i], align[i] ?? "left")).join(` ${dim("\u2502")} `));
  const dataRows = rows.map((row) =>
    row.map((cell, i) => pad(cell, colWidths[i], align[i] ?? "left")).join(` ${dim("\u2502")} `),
  );

  return [headerRow, sep, ...dataRows].join("\n");
}

export function spinner(): { start(msg: string): void; update(msg: string): void; stop(msg?: string): void } {
  const frames = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];
  let frameIdx = 0;
  let interval: ReturnType<typeof setInterval> | null = null;
  let currentMsg = "";

  function render() {
    process.stderr.write(`\r${gray(frames[frameIdx])} ${currentMsg}`);
    frameIdx = (frameIdx + 1) % frames.length;
  }

  return {
    start(msg: string) {
      currentMsg = msg;
      if (isTTY) {
        interval = setInterval(render, 80);
      } else {
        process.stderr.write(`${msg}\n`);
      }
    },
    update(msg: string) {
      currentMsg = msg;
    },
    stop(msg?: string) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (isTTY) {
        process.stderr.write(`\r${" ".repeat(currentMsg.length + 2)}\r`);
      }
      if (msg) {
        process.stderr.write(`${msg}\n`);
      }
    },
  };
}
