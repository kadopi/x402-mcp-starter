# x402 MCP Starter

Free, self-hosted Cloudflare Workers starter for adding USDC usage billing to an MCP server. It is intentionally small: no dashboard, custody, user account, or Aegis-specific feature is included.

## Product and public endpoint

This repository is the product: copy it, deploy it to your own Cloudflare account, and replace the reference paid handler with your own read-only service.

The public endpoint at `https://x402-mcp-starter.kadopi.workers.dev/mcp` is a Base Sepolia/test-USDC verification environment. It lets an x402-aware MCP client check the configuration tool and a fixed-price payment flow. It is not a hosted production payment service and it does not custody funds.

## Included flow

- `validate_x402_config`: free configuration review for Base USDC, price, amount, receiving address, and facilitator URL.
- `get_paid_sample`: fixed-price payment-flow reference, guarded by the official `@x402/core` and `@x402/evm` Exact EVM server APIs.
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
# Choose names, then create your D1 database.
npx wrangler d1 create your-x402-purchases
# Replace all placeholders in wrangler.jsonc: Worker name, D1 name/ID, and receiving address.
npx wrangler d1 execute your-x402-purchases --local --file migrations/0001_purchases.sql
cp .dev.vars.example .dev.vars
# Set X402_PAY_TO in .dev.vars to a valid public test wallet address.
npm run dev
```

Connect an MCP client to `http://localhost:8788/mcp`. Use `validate_x402_config` before deploying a paid tool. An unpaid `get_paid_sample` returns the payment challenge. The default price is 10,000 atomic USDC units (`0.01` USDC) on `eip155:84532`; `X402_AMOUNT` must match `X402_PRICE_USD × 1,000,000`.

## Testnet confirmation checklist

1. Create a D1 database and apply `migrations/0001_purchases.sql` locally or to a specifically chosen non-production D1 database.
2. Configure a Base Sepolia recipient and the facilitator URL. Keep `X402_NETWORK=eip155:84532` and the Base Sepolia USDC address.
3. Fund only the buyer test wallet with Base Sepolia test USDC (for example, Circle's test faucet). The EIP-3009 USDC flow is gasless for the buyer.
4. Call `validate_x402_config` with the configured network, asset, amount, price, recipient, and facilitator URL. Then call the paid tool without proof and confirm `x402/error` / `PAYMENT_REQUIRED`.
5. Use an x402-capable MCP client with a hard per-payment limit of 10,000 atomic units. Confirm its payment requirements: `exact`, `eip155:84532`, expected USDC asset, recipient, and amount.
6. Retry once with the returned payment proof; confirm the result and `x402/payment-response` receipt. Retry the same proof and input; confirm the saved result, not another settlement. Retry the proof with another option; confirm `payment_reuse_rejected`.
7. For a deliberate worker/network interruption after verification, retry only the same proof and confirm `payment_confirmation_pending` or the saved receipt. Inspect the D1 row before any manual reconciliation.

The included buyer example runs from a normal terminal only; it reads `EVM_PRIVATE_KEY` from that terminal environment and never sends it to the Worker. Create a separate disposable Base Sepolia payer locally (it writes the secret only to ignored `.testnet-payer.env`):

```sh
npm run payer:testnet:create
# Fund the displayed address with Base Sepolia test USDC, then set the endpoint and recipient you configured.
export X402_E2E_URL=https://your-worker.your-subdomain.workers.dev/mcp
export X402_E2E_PAY_TO=0x0000000000000000000000000000000000000000
set -a; source .testnet-payer.env; set +a; npm run e2e:testnet
```

It accepts only one exact Base Sepolia USDC requirement for 10,000 atomic units, addressed to the configured recipient. Do not paste a private key into chat or commit it to `.dev.vars`.

This package does not automatically create a D1 database, deploy a Worker, or make a payment. Base Mainnet is configuration-capable (`eip155:8453` and canonical USDC) but is not production-verified. A Mainnet rollout needs a separate approval because it can process real USDC.

## Operations limits

- Tool handlers must remain read-only in this starter. Do not use this flow for irreversible external updates without designing a separate authorization and recovery model.
- Settlement and delivery errors are distinct: `delivery_failed` includes the receipt reference when settlement succeeded; invalid or rejected proofs do not return a paid result.
- `createPaidToolHandler` in `src/paid-tool.ts` is the reusable payment adapter. Supply a tool name, resource metadata, and a read-only `execute` handler; keep the ledger and retry checks intact.

## Japanese quick start

`wrangler.jsonc` にD1 ID、`.dev.vars` に受取ウォレットを設定し、migration実行後に `npm run dev` を実行します。まず `validate_x402_config` で設定を確認してから、有料ツールの未払い402→対応クライアントの署名→同じ呼び出しの再送をTestnetで1往復確認してください。Mainnet、実USDC、デプロイはそれぞれ別承認で実行します。
