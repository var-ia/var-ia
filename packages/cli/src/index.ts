import type { Depth, ExportFormat } from "@wikipedia-provenance/evidence-graph";

// TODO: Wire to ingestion + analyzer + interpreter packages
// This is a placeholder demonstrating the CLI surface

const HELP = `
wikihistory — Wikipedia claim provenance engine

Usage:
  wikihistory analyze <page> [--depth brief|detailed|forensic]
  wikihistory claim <page> --text "<claim text>"
  wikihistory export <page> --format json|pdf|csv
  wikihistory watch <page> [--section <name>]

Options:
  --depth      Analysis depth (default: detailed)
  --text       Claim text to track across revisions
  --format     Export format
  --section    Watch a specific section only
  --from       Start revision ID
  --to         End revision ID
`;

export async function cli(args: string[]): Promise<void> {
  const command = args[0];

  switch (command) {
    case "analyze":
      console.log("analyze: not yet implemented");
      break;
    case "claim":
      console.log("claim: not yet implemented");
      break;
    case "export":
      console.log("export: not yet implemented");
      break;
    case "watch":
      console.log("watch: not yet implemented");
      break;
    case "--help":
    case "-h":
    default:
      console.log(HELP);
      break;
  }
}

// Entry point — called by the bin script via dist/src/index.js
// Runtime entry is handled by the bin field in package.json
