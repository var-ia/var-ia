# CLI Reference

The `refract` CLI is the primary entry point for running refract analyses (`wikihistory` also works).

## Commands

### analyze

Analyze a Wikipedia page's edit history.

```
refract analyze <page> [options]
```

**Options:**

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--depth` | `brief`, `detailed`, `forensic` | `detailed` | Analysis depth |
| `--from` | revision ID | earliest available | Start revision |
| `--to` | revision ID | latest available | End revision |
| `--cache` | flag | off | Cache revisions in SQLite (`~/.wikihistory/refract.db`) |

**Output:** Stream of `EvidenceEvent` objects to stdout, one per line, with deterministic facts listed.

**Example:**
```bash
refract analyze "Earth" --depth detailed --cache
```

### claim

Track a specific claim's provenance across revisions.

```
refract claim <page> --text "<claim text>" [--cache]
```

**Example:**
```bash
refract claim "Climate_change" --text "Global surface temperature has increased by 1.1°C since pre-industrial levels"
```

### export

Export analysis results in structured format.

```
refract export <page> --format json|csv
```

**Example:**
```bash
refract export "Albert_Einstein" --format csv
```

### watch

Monitor a page or section for changes.

```
refract watch <page> [--section <name>]
```

**Example:**
```bash
refract watch "COVID-19_pandemic" --section "Treatment"
```

## Caching

The `--cache` flag stores fetched revisions in `~/.wikihistory/refract.db` (SQLite via bun:sqlite). Subsequent runs skip already-fetched revisions. The cache schema:

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
