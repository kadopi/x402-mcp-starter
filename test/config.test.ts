import { describe, expect, it } from "vitest";
import { paymentConfig, paymentDefaults } from "../src/config";

const base = {
  X402_NETWORK: "eip155:84532", X402_ASSET: paymentDefaults.baseSepoliaUsdc, X402_AMOUNT: "10000",
  X402_PRICE_USD: "0.01", X402_PAY_TO: "0x1111111111111111111111111111111111111111", X402_FACILITATOR_URL: "https://x402.org/facilitator",
};
describe("paymentConfig", () => {
  it("accepts the Base Sepolia USDC tuple", () => expect(paymentConfig(base as Env).network).toBe("eip155:84532"));
  it("fails closed when network and USDC asset do not match", () => expect(() => paymentConfig({ ...base, X402_ASSET: paymentDefaults.baseUsdc } as Env)).toThrow("payment_not_configured"));
  it("accepts the separate Base mainnet tuple", () => expect(paymentConfig({ ...base, X402_NETWORK: "eip155:8453", X402_ASSET: paymentDefaults.baseUsdc } as Env).network).toBe("eip155:8453"));
});
