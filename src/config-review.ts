import { paymentDefaults } from "./config";

export interface X402ConfigReviewInput {
  network: "eip155:84532" | "eip155:8453";
  asset: string;
  amount: string;
  priceUsd: number;
  payTo: string;
  facilitatorUrl: string;
}

export function reviewX402Config(input: X402ConfigReviewInput) {
  const expectedAsset = input.network === "eip155:84532" ? paymentDefaults.baseSepoliaUsdc : paymentDefaults.baseUsdc;
  const expectedAmount = Number.isFinite(input.priceUsd) ? String(Math.round(input.priceUsd * 1_000_000)) : "";
  const errors: string[] = [];
  if (input.asset.toLowerCase() !== expectedAsset.toLowerCase()) errors.push(`asset must be the canonical USDC address for ${input.network}`);
  if (!/^[1-9][0-9]*$/.test(input.amount)) errors.push("amount must be a positive USDC atomic-unit integer");
  if (!Number.isFinite(input.priceUsd) || input.priceUsd <= 0) errors.push("priceUsd must be a positive number");
  if (expectedAmount && input.amount !== expectedAmount) errors.push(`amount must equal priceUsd × 1,000,000 (${expectedAmount})`);
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.payTo)) errors.push("payTo must be a 0x-prefixed EVM receiving address");
  try {
    const url = new URL(input.facilitatorUrl);
    if (url.protocol !== "https:") errors.push("facilitatorUrl must use HTTPS");
  } catch {
    errors.push("facilitatorUrl must be a valid HTTPS URL");
  }

  return {
    ready: errors.length === 0,
    errors,
    normalized: {
      network: input.network,
      expectedAsset,
      expectedAmount,
      payTo: input.payTo,
      facilitatorUrl: input.facilitatorUrl,
    },
    note: input.network === "eip155:84532"
      ? "Base Sepolia is appropriate for integration testing with test USDC."
      : "Base Mainnet uses real USDC. Confirm your own controlled end-to-end flow before offering paid access.",
  };
}
