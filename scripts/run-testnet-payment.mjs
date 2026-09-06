import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const endpoint = required("X402_E2E_URL");
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
  payTo: required("X402_E2E_PAY_TO"),
};

const baseClient = new Client({ name: "x402-mcp-starter-testnet", version: "0.1.0" });
const transport = new StreamableHTTPClientTransport(new URL(endpoint));

try {
  await baseClient.connect(transport);
  const request = { name: "get_paid_sample", arguments: { option: "basic" } };
  const unpaid = await baseClient.callTool(request);
  const paymentError = unpaid._meta?.["x402/error"];
  const requirements = paymentError?.accepts;
  if (!unpaid.isError || !paymentError || !Array.isArray(requirements) || !requirements.length || !requirements.every((item) =>
    item.scheme === expected.scheme && item.network === expected.network &&
    String(item.asset).toLowerCase() === expected.asset.toLowerCase() &&
    String(item.amount) === expected.amount && String(item.payTo).toLowerCase() === expected.payTo.toLowerCase(),
  )) throw new Error("unexpected_payment_requirements");

  const paymentClient = new x402Client();
  registerExactEvmScheme(paymentClient, { signer: account });
  const payload = await paymentClient.createPaymentPayload({
    x402Version: paymentError.x402Version ?? 2,
    resource: paymentError.resource,
    accepts: requirements,
    extensions: paymentError.extensions,
  });
  const paidRequest = { ...request, _meta: { "x402/payment": btoa(JSON.stringify(payload)) } };
  const result = await baseClient.callTool(paidRequest);
  const body = result.structuredContent;
  const receipt = body?.receipt ?? result._meta?.["x402/payment-response"];
  if (result.isError || !receipt || typeof receipt.purchaseId !== "string") throw new Error("testnet_payment_failed");
  const replay = await baseClient.callTool(paidRequest);
  const replayReceipt = replay.structuredContent?.receipt ?? replay._meta?.["x402/payment-response"];
  if (replay.isError || replayReceipt?.purchaseId !== receipt.purchaseId) throw new Error("testnet_replay_failed");
  console.log(JSON.stringify({ status: "settled_and_replayed", payer: account.address, purchaseId: receipt.purchaseId, receipt }, null, 2));
} finally {
  await baseClient.close();
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
