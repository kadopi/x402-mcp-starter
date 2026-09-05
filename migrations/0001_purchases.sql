CREATE TABLE IF NOT EXISTS purchases (
  purchase_id TEXT PRIMARY KEY,
  payment_fingerprint TEXT NOT NULL UNIQUE,
  payer TEXT,
  tool_name TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  network TEXT NOT NULL,
  asset TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('settling', 'settled', 'delivery_failed', 'unknown')),
  transaction_ref TEXT,
  result_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS purchases_expires_at ON purchases(expires_at);
