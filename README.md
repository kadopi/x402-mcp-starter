# x402 MCP Starter

Free, self-hosted Cloudflare Workers starter for an MCP server with one free tool and one USDC-paid tool. It is intentionally small: Base Sepolia is the default; no dashboard, custody, user account, or Aegis-specific feature is included.

## Included flow

- `list_rule_topics`: free Japan Rule-style sample catalog.
- `get_rule_brief`: fixed-price paid sample, guarded by the official `@x402/core` and `@x402/evm` Exact EVM server APIs.
- An unpaid paid-tool call returns a canonical MCP x402 error containing payment requirements. An x402-aware client signs, retries with `x402/payment`, and receives a tool result with `x402/payment-response`.
- A D1 purchase row binds a SHA-256 fingerprint of the payment proof to the tool name and canonical input hash. Reusing it for other input is rejected. Retrying the same call returns its saved result; a `settling` record returns `payment_confirmation_pending`, never a fresh charge request.
- Successful results are retained for 7 days. The database never stores a private key or raw payment proof.

This is at-least-once delivery around a payment gateway, not a claim of exactly-once execution. If the Worker stops after settlement but before storing delivery, retry with the **same** proof; do not make a second payment.

## Prerequisites

Node 20+, a Cloudflare account, a D1 database, a public Base Sepolia receiving address, a compatible x402 facilitator, and a client that supports MCP Streamable HTTP plus x402. The verified package versions are recorded in `package-lock.json` (`agents` 0.21.x, x402 2.23.x family).

The buyer's private key belongs only in its payment client. It is never configured in this Worker.

## Local setup

```sh
npm install
npx wrangler d1 create x402-mcp-starter
# Put the returned database_id in wrangler.jsonc; this is an edit only, not a deploy.
npx wrangler d1 execute x402-mcp-starter --local --file migrations/0001_purchases.sql
cp .dev.vars.example .dev.vars
# Set X402_PAY_TO in .dev.vars to a valid public test wallet address.
npm run dev
```

Connect an MCP client to `http://localhost:8788/mcp`. `list_rule_topics` works without payment. An unpaid `get_rule_brief` returns the payment challenge. The default price is 10,000 atomic USDC units (`0.01` USDC) on `eip155:84532`; `X402_AMOUNT` must match `X402_PRICE_USD × 1,000,000`.

## Testnet confirmation checklist

1. Create a D1 database and apply `migrations/0001_purchases.sql` locally or to a specifically chosen non-production D1 database.
2. Configure a Base Sepolia recipient and the facilitator URL. Keep `X402_NETWORK=eip155:84532` and the Base Sepolia USDC address.
3. Fund only the buyer test wallet with Base Sepolia ETH and test USDC (for example, Circle's test faucet).
4. Call the free tool, then call the paid tool without proof and confirm `x402/error` / `PAYMENT_REQUIRED`.
5. Use an x402-capable MCP client with a hard per-payment limit of 10,000 atomic units. Confirm its payment requirements: `exact`, `eip155:84532`, expected USDC asset, recipient, and amount.
6. Retry once with the returned payment proof; confirm the result and `x402/payment-response` receipt. Retry the same proof and input; confirm the saved result, not another settlement. Retry the proof with another topic; confirm `payment_reuse_rejected`.
7. For a deliberate worker/network interruption after verification, retry only the same proof and confirm `payment_confirmation_pending` or the saved receipt. Inspect the D1 row before any manual reconciliation.

No testnet USDC transfer, D1 creation, deployment, npm publish, or public release is performed by this repository. Base Mainnet is configuration-capable (`eip155:8453` and canonical USDC) but is not production-verified.

## Operations limits

- Tool handlers must remain read-only in this starter. Do not use this flow for irreversible external updates without designing a separate authorization and recovery model.
- Settlement and delivery errors are distinct: `delivery_failed` includes the receipt reference when settlement succeeded; invalid or rejected proofs do not return a paid result.
- The sample returns static data. Replace only the `body` in `paidRuleBrief` with your own read-only data retrieval after retaining the ledger checks.

## Japanese quick start

`wrangler.jsonc` にD1 ID、`.dev.vars` に受取ウォレットを設定し、migration実行後に `npm run dev` を実行します。無料ツールを確認してから、有料ツールの未払い402→対応クライアントの署名→同じ呼び出しの再送をTestnetで1往復確認してください。Mainnet、実USDC、デプロイはそれぞれ別承認で実行します。
