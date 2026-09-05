# 最新引き継ぎ 2026-09-05

- 現在地: x402 MCP Starterの最初の実装区切り。ローカル型確認・設定テストまで完了。
- 直近コミット: なし（Git commit / push は未実施）。
- 実装: Cloudflare Workersの`/mcp` Streamable HTTP、無料`list_rule_topics`、有料`get_rule_brief`。
- 決済SDK: 公式`@x402/core`/`@x402/evm` Exact EVMサーバーAPIを薄く利用。
- 初期設定: Base Sepolia `eip155:84532`、テストUSDC、0.01 USDC（10000 atomic）。
- 設定検証: network/USDC asset/価格と最小単位/受取先/facilitator URLが不一致ならfail closed。
- D1: `migrations/0001_purchases.sql`。証明fingerprint、payer、tool、input hash、状態、tx参照、結果を保存。
- 再送: 同じ証明・入力は保存結果を返す。別ツール/別入力への再利用は拒否。
- 不明状態: `settling` は`payment_confirmation_pending`を返し、新しい支払いを要求しない。
- 処理失敗: settlement後の保存・実行失敗は`delivery_failed`としてreceipt参照を残す。
- 結果保存: 7日。秘密鍵・生の支払い証明は保存・ログ出力しない。
- 確認済み: `npm run check` 成功。`npm test` は3件成功。
- 未確認: D1を使う結合テスト、実facilitator verify/settle、Testnet USDCの1往復。
- 未実施: Cloudflare D1作成、Cloudflare deploy、実USDC決済、npm公開、GitHub push。
- 安全境界: 購入者秘密鍵はWorkerに設定しない。サンプルtoolは読み取り専用の静的結果。
- 関連ファイル: `src/index.ts`, `src/config.ts`, `src/ledger.ts`, `migrations/0001_purchases.sql`, `README.md`。
- 次の最小作業: 承認後、指定Testnet D1へmigration→指定Workerへdeploy→受取先を確認した1回だけのTestnet支払いを往復確認。
- 注意: Mainnet設定は対応するが、本番検証済みではない。
