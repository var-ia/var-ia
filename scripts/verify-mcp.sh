#!/usr/bin/env bash
# MCP connectivity test
# Usage: bash scripts/verify-mcp.sh

echo "=== Refract MCP connectivity test ==="
echo ""

# Start MCP server, send tools/list, capture response
RESPONSE=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | timeout 5 npx @refract-org/cli mcp 2>/dev/null || echo "TIMEOUT_OR_ERROR")

if echo "$RESPONSE" | grep -q "tools/call"; then
  echo "✓ MCP server started and responded to tools/list"
  echo "  Tools discovered: $(echo "$RESPONSE" | grep -o '"name":"[^"]*"' | wc -l)"
  echo ""
  echo "=== Available tools ==="
  echo "$RESPONSE" | grep -o '"name":"[^"]*"' | sed 's/name":"/- /' | sed 's/"//'
  echo ""
  echo "=== Verify with Claude Desktop ==="
  echo "Add to your Claude Desktop config:"
  echo '{
  "mcpServers": {
    "refract": {
      "command": "npx",
      "args": ["@refract-org/cli", "mcp"]
    }
  }
}'
else
  echo "✗ MCP connectivity test failed"
  echo "  Response: $RESPONSE"
  echo ""
  echo "  Make sure @refract-org/cli is installed:"
  echo "    npm install -g @refract-org/cli"
  exit 1
fi
