import { writeFile, chmod } from "node:fs/promises";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const path = new URL("../.testnet-payer.env", import.meta.url);
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

await writeFile(path, `EVM_PRIVATE_KEY=${privateKey}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
await chmod(path, 0o600);

console.log(JSON.stringify({
  status: "created",
  network: "Base Sepolia",
  address: account.address,
  next: "Fund this address with Base Sepolia test USDC, then source .testnet-payer.env before npm run e2e:testnet.",
}, null, 2));
