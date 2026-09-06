import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";
import { paymentConfig } from "./config";
import { claimPurchase, getPurchase, saveDeliveryFailure, saveSettled, type Purchase } from "./ledger";

const RESULT_TTL_DAYS = 7;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (new URL(request.url).pathname === "/mcp") return createMcpHandler(() => createServer(env), { route: "/mcp" })(request, env, ctx);
    return Response.json({ name: "x402-mcp-starter", mcp: "/mcp", network: "Base Sepolia by default" });
  },
};

export function createServer(env: Env): McpServer {
  const config = paymentConfig(env);
  const server = new McpServer({ name: "x402 MCP Starter", version: "0.1.0" });
  const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient({ url: config.facilitatorUrl }));
  registerExactEvmScheme(resourceServer);
  let initialized: Promise<void> | undefined;
  const initialize = () => initialized ??= resourceServer.initialize();

  server.registerTool("list_sample_options", {
    title: "List free sample options",
    description: "Free sample: returns a small static catalog without payment.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => result({ free: true, options: ["basic", "standard", "extended"] }));

  server.registerTool("get_paid_sample", {
    title: "Get a paid sample result",
    description: "Paid sample: returns static data after an x402 USDC payment.",
    inputSchema: z.object({ option: z.enum(["basic", "standard", "extended"]) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (args, extra) => paidSample(args, extra, env, config, resourceServer, initialize));
  return server;
}

async function paidSample(args: { option: string }, extra: any, env: Env, config: ReturnType<typeof paymentConfig>, resourceServer: any, initialize: () => Promise<void>) {
  await initialize();
  const requirements = await resourceServer.buildPaymentRequirements({ scheme: "exact", payTo: config.recipient, price: config.priceUsd, network: config.network, maxTimeoutSeconds: 300 });
  const token = extra?.mcpReq?._meta?.["x402/payment"] ?? extra?._meta?.["x402/payment"] ?? extra?.requestInfo?.headers?.["PAYMENT-SIGNATURE"];
  if (typeof token !== "string") return paymentRequired(requirements);
  const fingerprint = await sha256(token);
  const inputHash = await sha256(canonicalJson(args));
  const existing = await getPurchase(env.DB, fingerprint);
  if (existing) return existingPurchase(existing, inputHash, "get_paid_sample", config);
  let payload: unknown;
  try { payload = JSON.parse(atob(token)); } catch { return paymentRequired(requirements, "INVALID_PAYMENT"); }
  const matching = resourceServer.findMatchingRequirements(requirements, payload);
  if (!matching) return paymentRequired(requirements, "INVALID_PAYMENT");
  let verification: any;
  try { verification = await resourceServer.verifyPayment(payload, matching); } catch { return paymentRequired(requirements, "INVALID_PAYMENT"); }
  if (!verification.isValid) return paymentRequired(requirements, verification.invalidReason ?? "INVALID_PAYMENT");
  const now = new Date();
  const claimed = await claimPurchase(env.DB, {
    purchase_id: crypto.randomUUID(), payment_fingerprint: fingerprint, payer: verification.payer ?? null,
    tool_name: "get_paid_sample", input_hash: inputHash, network: config.network, asset: config.asset, amount: config.amount,
    created_at: now.toISOString(), updated_at: now.toISOString(), expires_at: new Date(now.getTime() + RESULT_TTL_DAYS * 86_400_000).toISOString(),
  });
  if (!claimed.created) return existingPurchase(claimed.purchase, inputHash, "get_paid_sample", config);
  let settlement: any;
  try { settlement = await resourceServer.settlePayment(payload, matching); } catch { return pendingReceipt(claimed.purchase.purchase_id); }
  if (!settlement.success) return paymentRequired(requirements, settlement.errorReason ?? "SETTLEMENT_FAILED");
  const receipt = { purchaseId: claimed.purchase.purchase_id, status: "settled", transaction: settlement.transaction, network: settlement.network, payer: settlement.payer };
  try {
    const body = { option: args.option, summary: `Paid sample result for ${args.option}. Replace this handler with your own read-only data source.`, receipt };
    await saveSettled(env.DB, fingerprint, String(settlement.transaction ?? ""), body);
    return result(body, { "x402/payment-response": receipt });
  } catch {
    await saveDeliveryFailure(env.DB, fingerprint, String(settlement.transaction ?? ""), "tool_execution_or_persistence_failed");
    return error("delivery_failed", "Payment settled, but the result could not be saved. Retry the same payment proof; do not create a new payment.", receipt);
  }
}

function existingPurchase(purchase: Purchase, inputHash: string, toolName: string, config: ReturnType<typeof paymentConfig>) {
  if (purchase.input_hash !== inputHash || purchase.tool_name !== toolName || purchase.network !== config.network || purchase.asset.toLowerCase() !== config.asset.toLowerCase() || purchase.amount !== config.amount) return error("payment_reuse_rejected", "This payment proof belongs to a different tool call or price.");
  if (new Date(purchase.expires_at).getTime() <= Date.now()) return error("purchase_expired", "The saved result has expired. Do not reuse this payment proof.");
  if (purchase.status === "settled" && purchase.result_json) return result(JSON.parse(purchase.result_json));
  if (purchase.status === "delivery_failed") return error("delivery_failed", "Payment was settled but delivery failed. Use the same proof when retrying.", { purchaseId: purchase.purchase_id, transaction: purchase.transaction_ref });
  return pendingReceipt(purchase.purchase_id);
}
function paymentRequired(accepts: unknown, reason = "PAYMENT_REQUIRED") { return { isError: true, _meta: { "x402/error": { x402Version: 2, error: reason, resource: { url: "x402://get_paid_sample", description: "Get a paid sample result", mimeType: "application/json" }, accepts } }, content: [{ type: "text" as const, text: JSON.stringify({ error: reason, accepts }) }] }; }
function pendingReceipt(purchaseId: string) { return error("payment_confirmation_pending", "Settlement outcome is unknown. Retry only with the same payment proof; do not create a new payment.", { purchaseId }); }
function result(value: unknown, meta?: Record<string, unknown>) { return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value as Record<string, unknown>, ...(meta ? { _meta: meta } : {}) }; }
function error(code: string, message: string, details?: unknown) { const value = { error: code, message, ...(details && typeof details === "object" ? details : {}) }; return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value }; }
function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") { const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(",")}}`; } return JSON.stringify(value); }
async function sha256(value: string): Promise<string> { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join(""); }
