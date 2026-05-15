# Security considerations

## Credential exposure

CLI flags containing credentials (`--api-key`, `--api-password`) are visible in process listings.

**Recommendation:** Use environment variables instead:

```bash
# Instead of this (visible in ps aux):
wikihistory analyze "Page" --api-key "secret"

# Do this:
export WIKI_API_KEY="secret"
wikihistory analyze "Page" --api-key "$WIKI_API_KEY"
```

## Local storage

When using `--cache`, revision content is persisted to `~/.wikihistory/varia.db` (SQLite). This file contains full wikitext from every revision fetched. If you analyze private wikis, this database becomes a local copy of private content.

**Recommendation:** Don't use `--cache` with private wikis on shared machines, or configure `--cache-dir` to an encrypted volume.

## L2 model data flow

When you enable model interpretation (`--model openai`, `--model anthropic`, etc.), L1-extracted evidence snippets (before/after text from revision boundaries) are sent to the configured model provider's API. This is unavoidable for L2 functionality. The snippets are pre-extracted by deterministic analyzers — full revision wikitext is never transmitted. But the snippets may contain:

- Sentences from private wiki pages
- Organizational terminology
- Regulated data subject to compliance requirements

**Recommendation:** Do not enable L2 interpretation against private/compliance-sensitive wikis unless the model provider is covered by your data processing agreement.

## Network

Varia makes outbound HTTP requests to:
- The configured MediaWiki API (`--api`)
- Model provider APIs when L2 is enabled (`--model`)
- Slack/email/webhook endpoints when notifications are configured (`--notify-*`)

All requests use HTTPS. Authentication tokens are sent as `Authorization` headers or `x-api-key` headers per provider conventions.

## Reporting vulnerabilities

See [.github/SECURITY.md](../blob/main/.github/SECURITY.md) for the vulnerability reporting process.
