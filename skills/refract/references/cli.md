# CLI Reference

The `wikihistory` CLI is the primary entry point for running varia analyses.

## Commands

### analyze

Analyze a Wikipedia page's edit history.

```
wikihistory analyze <page> [options]
```

**Options:**

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--depth` | `brief`, `detailed`, `forensic` | `detailed` | Analysis depth |
| `--from` | revision ID | earliest available | Start revision |
| `--to` | revision ID | latest available | End revision |
| `--cache` | flag | off | Cache revisions in SQLite (`~/.wikihistory/varia.db`) |

**Output:** Stream of `EvidenceEvent` objects to stdout, one per line, with deterministic facts listed.

**Example:**
```bash
wikihistory analyze "Earth" --depth detailed --cache
```

### claim

Track a specific claim's provenance across revisions.

```
wikihistory claim <page> --text "<claim text>" [--cache]
```

**Example:**
```bash
wikihistory claim "Climate_change" --text "Global surface temperature has increased by 1.1°C since pre-industrial levels"
```

### export

Export analysis results in structured format.

```
wikihistory export <page> --format json|csv
```

**Example:**
```bash
wikihistory export "Albert_Einstein" --format csv
```

### watch

Monitor a page or section for changes.

```
wikihistory watch <page> [--section <name>]
```

**Example:**
```bash
wikihistory watch "COVID-19_pandemic" --section "Treatment"
```

## Caching

The `--cache` flag stores fetched revisions in `~/.wikihistory/varia.db` (SQLite via bun:sqlite). Subsequent runs skip already-fetched revisions. The cache schema:

- `revisions` table: `rev_id`, `page_id`, `page_title`, `timestamp`, `comment`, `content`, `size`, `minor`
- `claims` table: `claim_id`, `identity_key`, `page_title`, `current_state`, `proposition_type`, timestamps

## Programmatic Use

The CLI imports can also be used directly:

```ts
import { runAnalyze } from "@refract-org/cli";
import { runClaim } from "@refract-org/cli";
import { runExport } from "@refract-org/cli";
import { runWatch } from "@refract-org/cli";
```
