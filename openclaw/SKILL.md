---
name: x402-mcp-starter
summary: Use this self-hosted starter to validate a proposed x402 USDC configuration before adding one paid read-only tool to a Cloudflare Workers MCP server. It is not a managed payment service.
---

# x402 MCP Starter

Use this skill when an MCP product needs a small, x402-aware USDC payment path for a read-only result. Start before deployment, when the operator needs to check the network, USDC asset, price, recipient, and facilitator configuration.

Do not use it to custody wallets, move funds for another party, implement a subscription system, or turn an unvalidated product into a paid service.

## Connect

- MCP endpoint: `https://x402-mcp-starter.kadopi.workers.dev/mcp`
- MCP Service Card: `https://x402-mcp-starter.kadopi.workers.dev/.well-known/agent-card.json`
- Product page: `https://aegis-sales-bot.kadopi.workers.dev/products/x402-mcp-starter`
- Source: `https://github.com/kadopi/x402-mcp-starter`
- MCP Registry search: `https://registry.modelcontextprotocol.io/?q=io.github.kadopi%2Fx402-mcp-starter`

## Free configuration check

Call `validate_x402_config` before deployment with:

- `network`: `eip155:84532` for Base Sepolia test USDC, or `eip155:8453` for Base Mainnet real USDC;
- `asset`, `amount`, and `priceUsd`: the intended canonical USDC asset and matching atomic-unit price;
- `payTo`: the controlled recipient EVM address;
- `facilitatorUrl`: the HTTPS facilitator endpoint.

If `ready` is false, correct only the returned configuration errors. Do not deploy or attempt payment until it is true.

## Paid sample boundary

`get_paid_sample` is a fixed-price reference path, not product revenue. A call that may trigger payment requires the business principal's explicit approval immediately beforehand. Keep buyer keys in the payment client; never provide a private key or payment signature in a prompt, source file, log, or support message.

For a real customer product, replace the sample handler with one defined read-only result and state the price, delivery, retry, and failure behavior before release.

## Limits

The public endpoint uses Base Sepolia and test USDC by default. The buyer's private key stays in the payment client. Production Mainnet operation requires the operator's own configuration, deployment approval, and a separately authorized payment decision.
