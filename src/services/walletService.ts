// ============================================================
//  walletService — a self-custody Polygon wallet, browser-only.
//  Generates an EVM keypair on first use (your keys, like your
//  identity), stored locally; talks to Polygon through a public RPC
//  via ethers.js. No backend, no custody by us. Supports native MATIC
//  (gas/money) and USDC (a stablecoin = real "money"). It's a hot
//  burner wallet — keep only small amounts and export your key.
// ============================================================
import { JsonRpcProvider, Wallet, Contract, formatEther, parseEther, formatUnits, parseUnits, isAddress } from "ethers";
import { storage } from "./storage";

const RPC = "https://polygon-rpc.com";
export const CHAIN = { id: 137, name: "Polygon", explorer: "https://polygonscan.com" };
const USDC = "0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359"; // native USDC on Polygon (6 decimals)
const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
];

let provider: JsonRpcProvider | null = null;
let wallet: Wallet | null = null;

async function ensure(): Promise<Wallet> {
  if (wallet) return wallet;
  provider = new JsonRpcProvider(RPC, CHAIN.id);
  let pk = await storage.kvGet<string>("wallet:pk");
  if (!pk) { pk = Wallet.createRandom().privateKey; await storage.kvSet("wallet:pk", pk); }
  wallet = new Wallet(pk, provider);
  return wallet;
}

export type Currency = "MATIC" | "USDC";

class WalletService {
  isValidAddress = isAddress;
  explorerTx(hash: string) { return `${CHAIN.explorer}/tx/${hash}`; }

  async address(): Promise<string> { return (await ensure()).address; }

  async balances(): Promise<{ matic: string; usdc: string }> {
    const w = await ensure();
    const matic = await provider!.getBalance(w.address);
    let usdc = 0n;
    try { usdc = await new Contract(USDC, ERC20, provider!).balanceOf(w.address); } catch {}
    return { matic: Number(formatEther(matic)).toFixed(4), usdc: Number(formatUnits(usdc, 6)).toFixed(2) };
  }

  /** Send MATIC or USDC. Returns the tx hash. Throws on failure. */
  async send(to: string, amount: string, currency: Currency): Promise<string> {
    if (!isAddress(to)) throw new Error("Invalid address");
    const w = await ensure();
    if (currency === "USDC") {
      const tx = await new Contract(USDC, ERC20, w).transfer(to, parseUnits(amount, 6));
      return tx.hash;
    }
    const tx = await w.sendTransaction({ to, value: parseEther(amount) });
    return tx.hash;
  }

  async exportKey(): Promise<string> { return (await ensure()).privateKey; }
  async importKey(pk: string): Promise<string> {
    const p = new JsonRpcProvider(RPC, CHAIN.id);
    const w = new Wallet(pk.trim(), p);
    await storage.kvSet("wallet:pk", w.privateKey);
    wallet = w; provider = p;
    return w.address;
  }
}

export const walletService = new WalletService();
