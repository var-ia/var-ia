# @refract-org/cli

CLI tool — provides the `refract` command (alias: `wikihistory`).

```bash
bun add @refract-org/cli
```

## Commands

| Command | Description |
|---------|-------------|
| `analyze <page>` | Full edit history analysis with configurable depth |
| `claim <page> --text "<text>"` | Track a specific claim across revisions |
| `export <page> --format <format>` | Export analysis as json, csv, or ndjson |
| `visualize <page>` | Launch browser-based event visualizer |
| `watch <page>` | Live-polling daemon for new edits |
| `cron --config <file>` | Scheduled batch processing daemon |
| `diff --wiki-a <url> --wiki-b <url> <topic>` | Cross-wiki comparison of a topic |
| `eval` | Run evaluation harness against benchmark pages |
| `mcp` | Start Model Context Protocol server |

### Options

- `--depth brief|detailed|forensic` — analysis depth
- `--cache` — cache revisions in local SQLite
- `--from <revId>`, `--to <revId>` — scope to revision range
- `--pages-file <path>` — batch analyze multiple pages
- `--bundle` — export as signed evidence bundle with SHA-256 hash
- `--manifest` — export as replay manifest with Merkle tree of event hashes
- `--api <url>` — override MediaWiki API endpoint
- `--api-key <token>` — API key for private wiki auth
- `--interval <ms>` — poll interval for watch (default: 60000)

### Examples

```bash
refract analyze "COVID-19 pandemic" --depth detailed
refract claim "Theranos" --text "revolutionary blood testing"
refract export "Bitcoin" --format ndjson
refract export "Bitcoin" --bundle
refract export "Bitcoin" --manifest
refract diff --wiki-a https://starwars.fandom.com/api.php --wiki-b https://memory-alpha.fandom.com/api.php "energy weapons"
refract eval
```

[Refract](https://github.com/refract-org/refract) · [Docs](https://github.com/refract-org/refract-docs) · [npm](https://www.npmjs.com/package/@refract-org/cli)
