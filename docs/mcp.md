# MCP — model context protocol

`wikihistory mcp` starts a JSON-RPC server over stdio that exposes the Refract engine to AI agents via the Model Context Protocol.

## Usage

```bash
wikihistory mcp
```

The server runs indefinitely on stdin/stdout. It accepts JSON-RPC 2.0 requests and returns structured responses.

## Connecting an AI agent

### Claude Desktop

```json
{
  "mcpServers": {
    "sequent": {
      "command": "npx",
      "args": ["wikihistory", "mcp"]
    }
  }
}
```

### Cline / VS Code

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

## Available tools

### `analyze`

Analyze a MediaWiki page's full edit history.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `page` | string | ✅ | Page title (e.g., "Bitcoin", "Climate change") |
| `depth` | enum | | `brief` (metadata only), `detailed` (text included), `forensic` (full wikitext) |
| `api` | string | | MediaWiki API base URL. Defaults to English Wikipedia |
| `from` | string | | Start revision ID |
| `to` | string | | End revision ID |
| `since` | string | | Re-observe from ISO timestamp |

### `claim`

Track a specific claim's provenance across revisions.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `page` | string | ✅ | Page title |
| `text` | string | ✅ | Claim text to track (partial match supported) |
| `api` | string | | MediaWiki API base URL |

### `export`

Export page analysis as structured JSON.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `page` | string | ✅ | Page title |
| `api` | string | | MediaWiki API base URL |

### `cron`

Re-observe pages — for scheduled monitoring.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `pagesFile` | string | ✅ | File path with one page title per line |
| `interval` | string | | Lookback window in hours |
| `api` | string | | MediaWiki API base URL |

## Protocol details

- **Transport:** stdio (stdin for requests, stdout for responses)
- **Format:** JSON-RPC 2.0
- **Initialization:** Send `tools/list` to discover tools, `tools/call` to invoke

## Authentication

For private wikis, pass `apiKey`, `apiUser`, and `apiPassword` as parameters on any tool call.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "analyze",
    "arguments": { "page": "Internal Knowledge Base", "api": "https://wiki.internal.example.com/api.php", "apiKey": "sk-..." }
  }
}
```
