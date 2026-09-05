export interface PaymentConfig {
  network: "eip155:84532" | "eip155:8453";
  asset: string;
  amount: string;
  priceUsd: number;
  recipient: `0x${string}`;
  facilitatorUrl: string;
}

const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export function paymentConfig(env: Env): PaymentConfig {
  const network = String(env.X402_NETWORK ?? "");
  if (network !== "eip155:84532" && network !== "eip155:8453") throw new Error("payment_not_configured: invalid network");
  const expectedAsset = network === "eip155:84532" ? BASE_SEPOLIA_USDC : BASE_USDC;
  const asset = String(env.X402_ASSET ?? "");
  const amount = String(env.X402_AMOUNT ?? "");
  const recipient = String(env.X402_PAY_TO ?? "");
  const facilitatorUrl = String(env.X402_FACILITATOR_URL ?? "");
  const priceUsd = Number(env.X402_PRICE_USD ?? "");
  const expectedAmount = Number.isFinite(priceUsd) ? String(Math.round(priceUsd * 1_000_000)) : "";
  if (asset.toLowerCase() !== expectedAsset.toLowerCase() || !/^[1-9][0-9]*$/.test(amount) || amount !== expectedAmount ||
      !/^0x[a-fA-F0-9]{40}$/.test(recipient) || !Number.isFinite(priceUsd) || priceUsd <= 0) {
    throw new Error("payment_not_configured: Base USDC, positive atomic amount, price, and recipient are required");
  }
  try { new URL(facilitatorUrl); } catch { throw new Error("payment_not_configured: invalid facilitator URL"); }
  return { network, asset, amount, priceUsd, recipient: recipient as `0x${string}`, facilitatorUrl };
}

export const paymentDefaults = { baseSepoliaUsdc: BASE_SEPOLIA_USDC, baseUsdc: BASE_USDC };
