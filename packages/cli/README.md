# @var-ia/cli

CLI tool — provides the `wikihistory` command.

```bash
bun add @var-ia/cli
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
- `--model <provider>` — enable L2 model interpretation (openai, anthropic, deepseek, local, byok)
- `--router` — route to local open-weight models via Ollama
- `--from <revId>`, `--to <revId>` — scope to revision range
- `--pages-file <path>` — batch analyze multiple pages
- `--bundle` — export as signed evidence bundle with SHA-256 hash
- `--manifest` — export as replay manifest with Merkle tree of event hashes
- `--api <url>` — override MediaWiki API endpoint
- `--api-key <token>` — API key for private wiki auth
- `--interval <ms>` — poll interval for watch (default: 60000)

### Examples

```bash
wikihistory analyze "COVID-19 pandemic" --depth detailed
wikihistory claim "Theranos" --text "revolutionary blood testing"
wikihistory export "Bitcoin" --format ndjson
wikihistory export "Bitcoin" --bundle
wikihistory export "Bitcoin" --manifest
wikihistory diff --wiki-a https://starwars.fandom.com/api.php --wiki-b https://memory-alpha.fandom.com/api.php "energy weapons"
wikihistory eval
```

[Varia](https://github.com/var-ia/var-ia) · [Docs](https://github.com/var-ia/varia-docs) · [npm](https://www.npmjs.com/package/@var-ia/cli)
