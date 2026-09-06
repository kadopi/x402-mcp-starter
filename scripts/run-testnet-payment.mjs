import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { withX402Client } from "agents/x402";
import { privateKeyToAccount } from "viem/accounts";

const endpoint = process.env.X402_E2E_URL?.trim() || "https://x402-mcp-starter.kadopi.workers.dev/mcp";
const privateKey = required("EVM_PRIVATE_KEY");
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error("EVM_PRIVATE_KEY must be a 0x-prefixed 32-byte hex private key; do not use the literal placeholder 0x...");
}
const account = privateKeyToAccount(privateKey);
const expected = {
  scheme: "exact",
  network: "eip155:84532",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  amount: "10000",
  payTo: "0x6171D238FD82c293a39cEd6DF72A330532D00d76",
};

const baseClient = new Client({ name: "x402-mcp-starter-testnet", version: "0.1.0" });
const transport = new StreamableHTTPClientTransport(new URL(endpoint));

try {
  await baseClient.connect(transport);
  const client = withX402Client(baseClient, { account, network: expected.network, maxPaymentValue: 10_000n });
  const result = await client.callTool(async (requirements) => requirements.length === 1 && requirements.every((item) =>
    item.scheme === expected.scheme && item.network === expected.network &&
    String(item.asset).toLowerCase() === expected.asset.toLowerCase() &&
    String(item.amount) === expected.amount && String(item.payTo).toLowerCase() === expected.payTo.toLowerCase(),
  ), { name: "get_rule_brief", arguments: { topic: "privacy" } });
  const body = result.structuredContent;
  const receipt = body?.receipt ?? result._meta?.["x402/payment-response"];
  if (result.isError || !receipt || typeof receipt.purchaseId !== "string") throw new Error("testnet_payment_failed");
  console.log(JSON.stringify({ status: "settled", payer: account.address, purchaseId: receipt.purchaseId, receipt }, null, 2));
} finally {
  await baseClient.close();
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
