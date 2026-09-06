import { paymentConfig } from "./config";
import { claimPurchase, getPurchase, saveDeliveryFailure, saveSettled, type Purchase } from "./ledger";

const RESULT_TTL_DAYS = 7;

type ResourceServer = {
  buildPaymentRequirements(input: unknown): Promise<unknown>;
  findMatchingRequirements(requirements: unknown, payload: unknown): unknown;
  verifyPayment(payload: unknown, matching: unknown): Promise<{ isValid: boolean; invalidReason?: string; payer?: string }>;
  settlePayment(payload: unknown, matching: unknown): Promise<{ success: boolean; errorReason?: string; transaction?: unknown; network?: string; payer?: string }>;
};

export interface PaidToolOptions<TArgs extends Record<string, unknown>> {
  toolName: string;
  resource: { url: string; description: string };
  env: Env;
  config: ReturnType<typeof paymentConfig>;
  resourceServer: ResourceServer;
  initialize: () => Promise<void>;
  execute: (args: TArgs) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

export function createPaidToolHandler<TArgs extends Record<string, unknown>>(options: PaidToolOptions<TArgs>) {
  return async (args: TArgs, extra: any) => {
    await options.initialize();
    const requirements = await options.resourceServer.buildPaymentRequirements({ scheme: "exact", payTo: options.config.recipient, price: options.config.priceUsd, network: options.config.network, maxTimeoutSeconds: 300 });
    const token = extra?.mcpReq?._meta?.["x402/payment"] ?? extra?._meta?.["x402/payment"] ?? extra?.requestInfo?.headers?.["PAYMENT-SIGNATURE"];
    if (typeof token !== "string") return paymentRequired(requirements, options.resource);

    const fingerprint = await sha256(token);
    const inputHash = await sha256(canonicalJson(args));
    const existing = await getPurchase(options.env.DB, fingerprint);
    if (existing) return existingPurchaseResponse(existing, inputHash, options.toolName, options.config);

    let payload: unknown;
    try { payload = JSON.parse(atob(token)); } catch { return paymentRequired(requirements, options.resource, "INVALID_PAYMENT"); }
    const matching = options.resourceServer.findMatchingRequirements(requirements, payload);
    if (!matching) return paymentRequired(requirements, options.resource, "INVALID_PAYMENT");
    let verification;
    try { verification = await options.resourceServer.verifyPayment(payload, matching); } catch { return paymentRequired(requirements, options.resource, "INVALID_PAYMENT"); }
    if (!verification.isValid) return paymentRequired(requirements, options.resource, verification.invalidReason ?? "INVALID_PAYMENT");

    const now = new Date();
    const claimed = await claimPurchase(options.env.DB, {
      purchase_id: crypto.randomUUID(), payment_fingerprint: fingerprint, payer: verification.payer ?? null,
      tool_name: options.toolName, input_hash: inputHash, network: options.config.network, asset: options.config.asset, amount: options.config.amount,
      created_at: now.toISOString(), updated_at: now.toISOString(), expires_at: new Date(now.getTime() + RESULT_TTL_DAYS * 86_400_000).toISOString(),
    });
    if (!claimed.created) return existingPurchaseResponse(claimed.purchase, inputHash, options.toolName, options.config);

    let settlement;
    try { settlement = await options.resourceServer.settlePayment(payload, matching); } catch { return pendingReceipt(claimed.purchase.purchase_id); }
    if (!settlement.success) return paymentRequired(requirements, options.resource, settlement.errorReason ?? "SETTLEMENT_FAILED");

    const receipt = { purchaseId: claimed.purchase.purchase_id, status: "settled", transaction: settlement.transaction, network: settlement.network, payer: settlement.payer };
    try {
      const body = { ...await options.execute(args), receipt };
      await saveSettled(options.env.DB, fingerprint, String(settlement.transaction ?? ""), body);
      return result(body, { "x402/payment-response": receipt });
    } catch {
      await saveDeliveryFailure(options.env.DB, fingerprint, String(settlement.transaction ?? ""), "tool_execution_or_persistence_failed");
      return error("delivery_failed", "Payment settled, but the result could not be saved. Retry the same payment proof; do not create a new payment.", receipt);
    }
  };
}

export function existingPurchaseResponse(purchase: Purchase, inputHash: string, toolName: string, config: ReturnType<typeof paymentConfig>) {
  if (purchase.input_hash !== inputHash || purchase.tool_name !== toolName || purchase.network !== config.network || purchase.asset.toLowerCase() !== config.asset.toLowerCase() || purchase.amount !== config.amount) return error("payment_reuse_rejected", "This payment proof belongs to a different tool call or price.");
  if (new Date(purchase.expires_at).getTime() <= Date.now()) return error("purchase_expired", "The saved result has expired. Do not reuse this payment proof.");
  if (purchase.status === "settled" && purchase.result_json) return result(JSON.parse(purchase.result_json));
  if (purchase.status === "delivery_failed") return error("delivery_failed", "Payment was settled but delivery failed. Use the same proof when retrying.", { purchaseId: purchase.purchase_id, transaction: purchase.transaction_ref });
  return pendingReceipt(purchase.purchase_id);
}

function paymentRequired(accepts: unknown, resource: PaidToolOptions<Record<string, unknown>>["resource"], reason = "PAYMENT_REQUIRED") { return { isError: true, _meta: { "x402/error": { x402Version: 2, error: reason, resource: { ...resource, mimeType: "application/json" }, accepts } }, content: [{ type: "text" as const, text: JSON.stringify({ error: reason, accepts }) }] }; }
function pendingReceipt(purchaseId: string) { return error("payment_confirmation_pending", "Settlement outcome is unknown. Retry only with the same payment proof; do not create a new payment.", { purchaseId }); }
function result(value: unknown, meta?: Record<string, unknown>) { return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value as Record<string, unknown>, ...(meta ? { _meta: meta } : {}) }; }
function error(code: string, message: string, details?: unknown) { const value = { error: code, message, ...(details && typeof details === "object" ? details : {}) }; return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value }; }
function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") { const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(",")}}`; } return JSON.stringify(value); }
async function sha256(value: string): Promise<string> { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join(""); }
