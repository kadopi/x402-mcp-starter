export type PurchaseStatus = "settling" | "settled" | "delivery_failed" | "unknown";

export interface Purchase {
  purchase_id: string;
  payment_fingerprint: string;
  payer: string | null;
  tool_name: string;
  input_hash: string;
  network: string;
  asset: string;
  amount: string;
  status: PurchaseStatus;
  transaction_ref: string | null;
  result_json: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export async function getPurchase(db: D1Database, fingerprint: string): Promise<Purchase | null> {
  return db.prepare("SELECT * FROM purchases WHERE payment_fingerprint = ?").bind(fingerprint).first<Purchase>();
}

export async function claimPurchase(db: D1Database, purchase: Omit<Purchase, "status" | "transaction_ref" | "result_json" | "error_code">): Promise<{ created: boolean; purchase: Purchase }> {
  await db.prepare(`INSERT OR IGNORE INTO purchases
    (purchase_id, payment_fingerprint, payer, tool_name, input_hash, network, asset, amount, status, created_at, updated_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'settling', ?, ?, ?)`)
    .bind(purchase.purchase_id, purchase.payment_fingerprint, purchase.payer, purchase.tool_name, purchase.input_hash,
      purchase.network, purchase.asset, purchase.amount, purchase.created_at, purchase.updated_at, purchase.expires_at).run();
  const saved = await getPurchase(db, purchase.payment_fingerprint);
  if (!saved) throw new Error("purchase_persistence_failed");
  return { created: saved.purchase_id === purchase.purchase_id, purchase: saved };
}

export async function saveSettled(db: D1Database, fingerprint: string, transactionRef: string, result: unknown): Promise<void> {
  await db.prepare("UPDATE purchases SET status = 'settled', transaction_ref = ?, result_json = ?, updated_at = ? WHERE payment_fingerprint = ? AND status = 'settling'")
    .bind(transactionRef, JSON.stringify(result), new Date().toISOString(), fingerprint).run();
}

export async function saveDeliveryFailure(db: D1Database, fingerprint: string, transactionRef: string, code: string): Promise<void> {
  await db.prepare("UPDATE purchases SET status = 'delivery_failed', transaction_ref = ?, error_code = ?, updated_at = ? WHERE payment_fingerprint = ? AND status = 'settling'")
    .bind(transactionRef, code, new Date().toISOString(), fingerprint).run();
}
