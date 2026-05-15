# Recipes

Task-first guide. Find what you need by what you want to do, not by what
Refract calls it.

---

## Track a Specific Claim

**I want to know when a sentence first appeared, was removed, or reintroduced.**

```bash
wikihistory claim "Bitcoin" --text "cryptocurrency"
```

Returns timeline of the claim across revisions. Example output:

```
[2009-03-08] sentence_first_seen: "Bitcoin is a cryptocurrency"
  Section: lead — rev 275832581→275832690
[2017-06-15] sentence_reintroduced: "Bitcoin is a cryptocurrency" 
  Section: lead — rev 456789012→456789013
```

## Cross-Wiki Comparison

**I want to compare how Wikipedia and Fandom cover the same topic.**

```bash
wikihistory diff "Star Wars" \
  --wiki-a https://en.wikipedia.org/w/api.php \
  --wiki-b https://starwars.fandom.com/api.php
```

Example output:

```
Cross-Wiki Diff: "Star Wars"
  Wiki A: https://en.wikipedia.org/w/api.php
  Wiki B: https://starwars.fandom.com/api.php

── Overview ──
  Total events      340    217
  Sections           12      8
  Citations          87     34
  Reverts            23     5
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

**I want Claude/Cursor/Copilot to call Refract deterministically.**

Add to your MCP client config:

```json
{
  "mcpServers": {
    "sequent": {
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
# Refract: when did a claim appear, change, disappear
wikihistory analyze "Bitcoin" --depth detailed | grep claim
```

---

## Equivalent to ORES

**I used ORES for edit quality scores. How do I get deterministic classification?**

```bash
# ORES: ML score for "likely damaging"
# Refract: deterministic revert detection + policy signal classification
wikihistory analyze "Bitcoin" --depth detailed | grep -E "revert|template"
```
