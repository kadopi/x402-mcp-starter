import { describe, expect, it } from "vitest";
import { paymentDefaults } from "../src/config";
import { reviewX402Config } from "../src/config-review";

const valid = {
  network: "eip155:84532" as const,
  asset: paymentDefaults.baseSepoliaUsdc,
  amount: "10000",
  priceUsd: 0.01,
  payTo: "0x1111111111111111111111111111111111111111",
  facilitatorUrl: "https://x402.org/facilitator",
};

describe("reviewX402Config", () => {
  it("accepts a matching Base Sepolia configuration", () => expect(reviewX402Config(valid)).toMatchObject({ ready: true, errors: [] }));
  it("explains a mismatched asset and amount", () => expect(reviewX402Config({ ...valid, asset: paymentDefaults.baseUsdc, amount: "1" })).toMatchObject({ ready: false, errors: expect.arrayContaining([expect.stringContaining("asset"), expect.stringContaining("amount")]) }));
  it("rejects an invalid recipient and non-HTTPS facilitator", () => expect(reviewX402Config({ ...valid, payTo: "wrong", facilitatorUrl: "http://example.com" })).toMatchObject({ ready: false, errors: expect.arrayContaining([expect.stringContaining("payTo"), expect.stringContaining("HTTPS")]) }));
});
