import { describe, expect, it } from "vitest";
import { paymentConfig, paymentDefaults } from "../src/config";
import { existingPurchaseResponse } from "../src/paid-tool";
import type { Purchase } from "../src/ledger";

const config = paymentConfig({
  X402_NETWORK: "eip155:84532", X402_ASSET: paymentDefaults.baseSepoliaUsdc, X402_AMOUNT: "10000",
  X402_PRICE_USD: "0.01", X402_PAY_TO: "0x1111111111111111111111111111111111111111", X402_FACILITATOR_URL: "https://x402.org/facilitator",
} as Env);
const purchase: Purchase = {
  purchase_id: "purchase-1", payment_fingerprint: "fingerprint", payer: null, tool_name: "get_paid_sample", input_hash: "input-a",
  network: config.network, asset: config.asset, amount: config.amount, status: "settled", transaction_ref: "tx", result_json: JSON.stringify({ option: "basic" }), error_code: null,
  created_at: "2026-09-06T00:00:00.000Z", updated_at: "2026-09-06T00:00:00.000Z", expires_at: "2099-09-06T00:00:00.000Z",
};

describe("existingPurchaseResponse", () => {
  it("returns the saved result for the same proof and input", () => expect(existingPurchaseResponse(purchase, "input-a", "get_paid_sample", config).structuredContent).toEqual({ option: "basic" }));
  it("rejects a proof reused for different input", () => expect(existingPurchaseResponse(purchase, "input-b", "get_paid_sample", config).structuredContent).toMatchObject({ error: "payment_reuse_rejected" }));
  it("does not request a new payment while settlement is pending", () => expect(existingPurchaseResponse({ ...purchase, status: "settling", result_json: null }, "input-a", "get_paid_sample", config).structuredContent).toMatchObject({ error: "payment_confirmation_pending" }));
});
