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

When using `--cache`, revision content is persisted to `~/.wikihistory/refract.db` (SQLite). This file contains full wikitext from every revision fetched. If you analyze private wikis, this database becomes a local copy of private content.

**Recommendation:** Don't use `--cache` with private wikis on shared machines, or configure `--cache-dir` to an encrypted volume.

## Network

Refract makes outbound HTTPS requests to:
- The configured MediaWiki API (`--api`)
- Slack/email/webhook endpoints when notifications are configured (`--notify-*`)

All requests use HTTPS. Authentication tokens are sent as `Authorization` headers or `x-api-key` headers per provider conventions.

## Reporting vulnerabilities

See [.github/SECURITY.md](../.github/SECURITY.md) for the vulnerability reporting process.
