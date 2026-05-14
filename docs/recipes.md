# Recipes

Task-first guide. Find what you need by what you want to do, not by what
Varia calls it.

---

## Track a Specific Claim

**I want to know when a sentence first appeared, was reworded, or removed.**

```bash
wikihistory claim "Bitcoin" --text "peer-to-peer electronic cash"
```

Output: timeline with `first_seen`, `reworded`, `strengthened`, `softened`, `removed`.

**I want the claim provenance as structured data:**

```bash
wikihistory export "Bitcoin" --format ndjson | jq 'select(.eventType | startswith("claim"))'
```

---

## Find Source Changes

**I want to know which citations were added or removed and when.**

```bash
wikihistory analyze "Bitcoin" --depth brief | grep citation
```

**I want the full source lineage (which source replaced which):**

```bash
wikihistory export "Bitcoin" --format json | jq '.events[] | select(.eventType | startswith("citation"))'
```

---

## Detect Policy Signal Changes

**I want to see when NPOV, BLP, or verifiability templates appeared on a page.**

```bash
wikihistory analyze "Bitcoin" --depth detailed | grep template
```

---

## Audit Reverts and Edit Warring

**I want to find all reverts in a page history.**

```bash
wikihistory analyze "Bitcoin" --depth forensic | grep revert
```

---

## Monitor Pages for Changes (CI/Cron)

**I want to check pages daily and alert if anything changed.**

```bash
echo "Bitcoin" > pages.txt
echo "Climate change" >> pages.txt
wikihistory cron pages.txt --interval 24
```

Returns exit code 1 if new events detected.

## Cross-Wiki Comparison

**I want to compare how Wikipedia and Fandom cover the same topic.**

```bash
wikihistory diff "Star Wars" \
  --wiki-a https://en.wikipedia.org/w/api.php \
  --wiki-b https://starwars.fandom.com/api.php
```

---

## Private Wiki Access

**I want to analyze a corporate wiki behind authentication.**

```bash
# Bearer token
wikihistory analyze "Internal Policy" --api https://corp.example.com/w/api.php --api-key "sk-..."

# Basic auth
wikihistory analyze "Internal Policy" --api https://corp.example.com/w/api.php --api-user "user" --api-password "pass"

# OAuth2
OAUTH_CLIENT_ID="..." OAUTH_CLIENT_SECRET="..." \
  wikihistory analyze "Internal Policy" --api https://corp.example.com/w/api.php
```

---

## MCP: AI Agent Integration

**I want Claude/Cursor/Copilot to call Varia deterministically.**

Add to your MCP client config:

```json
{
  "mcpServers": {
    "varia": {
      "command": "bunx",
      "args": ["wikihistory", "mcp"]
    }
  }
}
```

Then ask: "When did the Bitcoin article first call it a cryptocurrency?"

---

## Equivalent to WikiWho

**I used WikiWho for token authorship. How do I get claim provenance?**

```bash
# WikiWho: who wrote which token
# Varia: when did a claim appear, change, disappear
wikihistory analyze "Bitcoin" --depth detailed | grep claim
```

---

## Equivalent to ORES

**I used ORES for edit quality scores. How do I get deterministic classification?**

```bash
# ORES: ML score for "likely damaging"
# Varia: deterministic revert detection + policy signal classification
wikihistory analyze "Bitcoin" --depth detailed | grep -E "revert|template"
```
