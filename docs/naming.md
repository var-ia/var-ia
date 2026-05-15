# Naming conventions

## The split explained

| Name | What it is | Why |
|------|-----------|-----|
| **Refract** | The project | Latin for "change" — the engine observes change |
| **var-ia** | GitHub organization | `varia` was taken; `var-ia` was available |
| **`@refract-org/*`** | npm package scope | All lowercase by npm convention |
| **`wikihistory`** | CLI command verb | What you do: analyze wiki revision history |

## Why `wikihistory` and not `varia`?

The CLI is named after the action it performs, not the project it belongs to. When you type `wikihistory analyze "Bitcoin"`, the meaning is self-evident: analyze the wiki history of Bitcoin. `varia analyze` would require prior knowledge of what Refract is.

## Package paths

```bash
# Install the CLI
bun add -g @refract-org/cli

# Run it
wikihistory analyze "Earth"

# Import from packages
import { sectionDiffer } from "@refract-org/analyzers";
import type { EvidenceEvent } from "@refract-org/evidence-graph";
```

## In code

- Use `Refract` (capital V) as the project name in prose
- Use `@refract-org/<name>` when referencing packages
- Use `wikihistory` when referencing the CLI command

## In shell

```bash
wikihistory --version    # 0.3.1
which wikihistory        # points to @refract-org/cli binary
```
