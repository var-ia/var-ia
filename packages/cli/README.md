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
| `export <page> --format json\|csv` | Export analysis in structured format |
| `watch <page>` | Live-follow new edits to a page |
| `eval` | Run evaluation harness against benchmark pages |

### Options

- `--depth brief\|detailed\|forensic` — analysis depth
- `--cache` — cache revisions in local SQLite
- `--model <provider>` — enable L2 model interpretation
- `--from <revId>`, `--to <revId>` — scope to revision range
- `--pages-file <path>` — batch analyze multiple pages

```bash
wikihistory analyze "COVID-19 pandemic" --depth detailed
wikihistory claim "Theranos" --text "revolutionary blood testing"
wikihistory eval
```
