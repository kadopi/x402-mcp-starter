---
name: x402-mcp-starter
summary: Use this free self-hosted starter to validate an x402 USDC billing configuration before adding a paid read-only tool to a Cloudflare Workers MCP server.
---

# x402 MCP Starter

Use this skill when building an MCP server that needs an x402-aware, USDC usage-payment flow. This is starter code, not a managed payment service.

## Connect

- MCP endpoint: `https://x402-mcp-starter.kadopi.workers.dev/mcp`
- MCP Service Card: `https://x402-mcp-starter.kadopi.workers.dev/.well-known/agent-card.json`
- Product page: `https://aegis-sales-bot.kadopi.workers.dev/products/x402-mcp-starter`
- Source: `https://github.com/kadopi/x402-mcp-starter`
- MCP Registry search: `https://registry.modelcontextprotocol.io/?q=io.github.kadopi%2Fx402-mcp-starter`

## First call

Call `validate_x402_config` with the intended Base USDC network, asset, amount, receiving address, and facilitator URL before deploying a paid tool.

## Limits

The public endpoint uses Base Sepolia and test USDC by default. The buyer's private key stays in the payment client. Production Mainnet operation requires the operator's own configuration and approval.
