import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { isConnected, getAddress, requestAccess, signTransaction } from "@stellar/freighter-api";
import { Horizon, TransactionBuilder, Networks, xdr, Keypair, Operation, Address, Account } from "stellar-sdk";

const HORIZON_URL = import.meta.env.VITE_HORIZON_URL || "https://horizon-testnet.stellar.org";
const RPC_URL = import.meta.env.VITE_RPC_URL || "https://soroban-testnet.stellar.org";
const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const NATIVE_TOKEN = import.meta.env.VITE_NATIVE_TOKEN || "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const EXPLORER = "https://stellar.expert/explorer/testnet";

const server = new Horizon.Server(HORIZON_URL);
type TxState = "idle" | "pending" | "success" | "fail";
const FLAGS = ["🇺🇸", "🇨🇦", "🇲🇽", "🇧🇷", "🇦🇷", "🇩🇪", "🇫🇷", "🇪🇸", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "🇳🇱", "🇵🇹", "🇨🇴"];

function scvAddr(a: string): xdr.ScVal {
  if (!a || a.length !== 56) throw new Error(`Invalid address: "${a?.slice(0, 12)}..." (len=${a?.length})`);
  return new Address(a).toScVal();
}
function scvStr(s: string): xdr.ScVal { return xdr.ScVal.scvString(s); }
function scvI128(n: bigint): xdr.ScVal { return xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: new xdr.Int64(BigInt.asIntN(64, n >> 64n)), lo: new xdr.Uint64(BigInt.asUintN(64, n)) })); }
function scvU32(n: number): xdr.ScVal { return xdr.ScVal.scvU32(n); }
function scvU64(n: bigint): xdr.ScVal { return xdr.ScVal.scvU64(new xdr.Uint64(n)); }
function scvBool(b: boolean): xdr.ScVal { return xdr.ScVal.scvBool(b); }
function f(a: string) { return `${a.slice(0, 6)}...${a.slice(-4)}`; }

interface Bet { user: string; amount: number; claimed: boolean; }
interface Market {
  id: number; creator: string; question: string; deadline: number;
  resolved: boolean; outcome: boolean; resolved_at: number;
  yes_pool: number; no_pool: number; yes_bets: Bet[]; no_bets: Bet[];
}

async function callRpc(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: ctrl.signal });
    const d = await r.json(); if (d.error) throw new Error(d.error.message ?? JSON.stringify(d.error));
    return d.result as Record<string, unknown>;
  } finally { clearTimeout(t); }
}

async function waitForTx(hash: string): Promise<{ status: "SUCCESS" | "FAILED" | "TIMEOUT"; error?: string }> {
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1500));
    try {
      const st = await callRpc("getTransaction", { hash }) as { status: string };
      if (st.status === "SUCCESS") return { status: "SUCCESS" };
      if (st.status === "FAILED") {
        return { status: "FAILED", error: "Transaction failed on-chain" };
      }
    } catch { /* poll error — keep going */ }
  }
  return { status: "TIMEOUT", error: "TX taking longer than expected" };
}

function friendlyErr(_func: string, raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("deadline passed") || r.includes("deadline must be")) return "⏰ Deadline has passed — create a new market with a future deadline";
  if (r.includes("deadline not reached")) return "⏰ Deadline hasn't been reached yet — wait until after the deadline to resolve";
  if (r.includes("already resolved")) return "🔒 Market already resolved";
  if (r.includes("no winning bet")) return "😔 You bet on the losing side — no winnings to claim";
  if (r.includes("already claimed")) return "✅ Already claimed";
  if (r.includes("not resolved")) return "⏳ Market not resolved yet";
  if (r.includes("only creator")) return "🔑 Only the market creator can perform this action";
  if (r.includes("not found")) return "❓ Market not found on-chain";
  if (r.includes("resource limit")) return "⚡ Transaction too complex — try a smaller amount or increase fee";
  if (r.includes("unreachablecode") || r.includes("hosterror")) return "⚠️ Contract rejected — deadline passed, market resolved, or insufficient balance";
  return `Simulation error: ${raw.slice(0, 200)}`;
}

async function simSignSend(
  func: string,
  args: xdr.ScVal[],
  userAddr: string,
  onConfirm: () => void,
): Promise<string> {
  console.log("[simSignSend]", func, "with", args.length, "args");

  const fresh = await server.loadAccount(userAddr);
  const raw = new TransactionBuilder(fresh, { fee: "100000", networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: func, args }))
    .setTimeout(300).build();

  console.log("[simSignSend] simulating...");
  const sim = await callRpc("simulateTransaction", { transaction: raw.toXDR() }) as Record<string, unknown>;
  console.log("[simSignSend] sim keys:", Object.keys(sim));

  if (sim.error) {
    const raw = typeof sim.error === "string" ? sim.error : JSON.stringify(sim.error);
    throw new Error(friendlyErr(func, raw));
  }
  if ((sim as { result?: { error?: string } }).result?.error) {
    throw new Error(`Simulation failed: ${(sim as { result: { error: string } }).result.error}`);
  }

  const results = sim.results as Array<{ auth?: string[]; xdr?: string }> | undefined;
  const minResourceFee = sim.minResourceFee as string | undefined;
  const transactionData = sim.transactionData as string | undefined;

  if (!results?.[0]) throw new Error("Simulation returned no results");

  const authEntries: xdr.SorobanAuthorizationEntry[] = [];
  for (const entry of (results[0].auth || [])) {
    try {
      authEntries.push(xdr.SorobanAuthorizationEntry.fromXDR(entry, "base64"));
    } catch (e: unknown) {
      console.log("[simSignSend] auth entry parse failed:", (e as Error).message);
    }
  }
  console.log("[simSignSend] auth entries:", authEntries.length);

  let sorobanData: xdr.SorobanTransactionData;
  try {
    sorobanData = xdr.SorobanTransactionData.fromXDR(transactionData!, "base64");
    console.log("[simSignSend] parsed transactionData OK");
  } catch (e: unknown) {
    const msg = (e as Error).message ?? "";
    console.log("[simSignSend] transactionData parse failed:", msg, "- using fallback");
    sorobanData = new xdr.SorobanTransactionData({
      resources: new xdr.SorobanResources({
        footprint: new xdr.LedgerFootprint({ readOnly: [], readWrite: [] }),
        instructions: 0, readBytes: 0, writeBytes: 0,
      }),
      ext: new (xdr.ExtensionPoint as unknown as new (v: number) => xdr.ExtensionPoint)(0),
      resourceFee: new xdr.Int64(parseInt(minResourceFee || "0")),
    });
  }

  const fee = (100000 + parseInt(minResourceFee || "0")).toString();
  const finalAcct = await server.loadAccount(userAddr);
  const rawOp0 = raw.operations[0] as { func: xdr.HostFunction; auth: xdr.SorobanAuthorizationEntry[] };
  const tx = new TransactionBuilder(finalAcct, { fee, networkPassphrase: Networks.TESTNET, sorobanData })
    .addOperation(Operation.invokeHostFunction({
      func: rawOp0.func,
      auth: authEntries,
    }))
    .setTimeout(300).build();

  console.log("[simSignSend] signing with Freighter...");
  onConfirm();
  const { signedTxXdr } = await signTransaction(tx.toXDR(), { networkPassphrase: Networks.TESTNET, address: userAddr });

  console.log("[simSignSend] sending TX...");
  const send = await callRpc("sendTransaction", { transaction: signedTxXdr }) as unknown as { hash: string; status: string; errorResult?: string };
  if (send.errorResult) throw new Error(`Send failed: ${JSON.stringify(send.errorResult).slice(0, 200)}`);
  if (send.status === "ERROR") throw new Error("Transaction submission error");

  console.log("[simSignSend] waiting for TX", send.hash);
  const result = await waitForTx(send.hash);
  console.log("[simSignSend] TX result:", result.status);
  if (result.status === "FAILED") throw new Error(result.error ?? "Transaction failed on-chain");
  if (result.status === "TIMEOUT") throw new Error("TX taking longer than expected, check explorer");

  return send.hash;
}

function parseBet(m: any): Bet | null {
  const fields: Record<string, xdr.ScVal> = {};
  for (let i = 0; i < m.length; i++) {
    try { const k = m[i].key().sym()?.toString() || ""; if (!k) continue; const v = m[i].val(); if (v) fields[k] = v; } catch {}
  }
  const addr = (s: xdr.ScVal | undefined) => { try { return s ? Address.fromScVal(s).toString() : ""; } catch { return ""; } };
  return { user: addr(fields.user), amount: Number(fields.amount?.i128()?.lo()?.toString() ?? "0"), claimed: parseClaimed(fields.claimed) };
}

function parseClaimed(v: xdr.ScVal | undefined): boolean {
  if (!v) return false;
  try { const b = (v as any)?.bool?.(); if (b !== undefined) return b; } catch {}
  try { const u = (v as any)?.u32?.(); if (u !== undefined) return u !== 0; } catch {}
  return false;
}

function parseMarket(entries: any[], id: number): Market | null {
  const fields: Record<string, xdr.ScVal> = {};
  for (let i = 0; i < entries.length; i++) {
    try { const k = entries[i].key().sym()?.toString() || ""; if (!k) continue; const v = entries[i].val(); if (v) fields[k] = v; } catch {}
  }
  const addr = (s: xdr.ScVal | undefined) => { try { return s ? Address.fromScVal(s).toString() : ""; } catch { return ""; } };
  const yesBets: Bet[] = []; const noBets: Bet[] = [];
  if (fields.no_bets) { let v; try { v = fields.no_bets.vec(); } catch {} if (v) for (const b of v) { let mv; try { mv = b.map(); } catch {} if (mv) { const pb = parseBet(mv); if (pb) noBets.push(pb); } } }
  return {
    id, creator: addr(fields.creator), question: fields.question?.str()?.toString() ?? "",
    deadline: Number(fields.deadline?.u64()?.toString() ?? "0"),
    resolved: ((fields.resolved as any)?.bool?.() ?? false), outcome: ((fields.outcome as any)?.bool?.() ?? false),
    resolved_at: Number(fields.resolved_at?.u64()?.toString() ?? "0"),
    yes_pool: Number(fields.yes_pool?.i128()?.lo()?.toString() ?? "0"), no_pool: Number(fields.no_pool?.i128()?.lo()?.toString() ?? "0"),
    yes_bets: yesBets, no_bets: noBets,
  };
}

export default function Dashboard() {
  const [addr, setAddr] = useState<string | null>(null);
  const [walletName, setWalletName] = useState("");
  const [balance, setBalance] = useState<string | null>(null);
  const [showWm, setShowWm] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: string; msg: string; txHash?: string } | null>(null);
  const [payTx, setPayTx] = useState<TxState>("idle");

  // Create form
  const [question, setQuestion] = useState("");
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState(false);

  // Bet form
  const [betMarket, setBetMarket] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [betSide, setBetSide] = useState<boolean>(true);

  const reloadWithDelay = () => { setTimeout(() => loadMarkets(), 2000); };

  const fetchBalance = async (a: string) => {
    try {
      const acc = await server.loadAccount(a);
      const xlm = acc.balances.find((b: { asset_type: string }) => b.asset_type === "native");
      const bl = parseFloat(xlm?.balance ?? "0");
      setBalance(bl.toLocaleString("de-DE", { maximumFractionDigits: 3, minimumFractionDigits: 0 }));
    } catch { setBalance("0.0000"); }
  };

  const doConnect = async (a: string) => {
    setAddr(a); setWalletName("Freighter");
    await fetchBalance(a);
    await loadMarkets();
  };

  useEffect(() => { isConnected().then(r => { if (r.isConnected) getAddress().then(({ address: a }) => doConnect(a)); }).catch(() => {}); }, []);

  useEffect(() => { if (status && status.type !== "error") { const t = setTimeout(() => setStatus(null), 3000); return () => clearTimeout(t); } }, [status]);

  const connectFreighter = async () => {
    const { address: a, error: e } = await requestAccess();
    if (e || !a) { setStatus({ type: "error", msg: "Install Freighter extension." }); return; }
    setShowWm(false);
    await doConnect(a);
  };

  const loadMarkets = async () => {
    setLoading(true); setStatus(null);
    try {
      const pk = addr || Keypair.random().publicKey();
      const acct = new Account(pk, "0");
      const raw = new TransactionBuilder(acct, { fee: "100", networkPassphrase: Networks.TESTNET })
        .addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: "get_markets", args: [] }))
        .setTimeout(300).build();
      const sim = await callRpc("simulateTransaction", { transaction: raw.toXDR() }) as unknown as { results?: Array<{ xdr?: string }>; error?: string };
      if (!sim.results?.[0]?.xdr) { setMarkets([]); setStatus({ type: "success", msg: "No markets yet" }); return; }
      let rv: xdr.ScVal;
      try { rv = xdr.ScVal.fromXDR(sim.results[0].xdr, "base64"); } catch {
        setMarkets([]); setStatus({ type: "error", msg: "Failed to parse market data (XDR mismatch — SDK outdated)" }); return;
      }
      try {
        const vec = rv.vec();
        if (!vec) { setMarkets([]); return; }
        const parsed: Market[] = [];
        for (let i = 0; i < vec.length; i++) {
          let m;
          try { m = vec[i].map(); } catch (e) { console.log("[loadMarkets] .map() fail on index", i, (e as Error).message); continue; }
          if (!m) continue;
          const market = parseMarket(m, i); if (market) parsed.push(market);
        }
        setMarkets(parsed);
        setStatus(null);
      } catch (e: unknown) {
        console.error("[loadMarkets] parse failed:", (e as Error).message, (e as Error).stack);
        setMarkets([]); setStatus({ type: "error", msg: "Markets exist but failed to parse (XDR mismatch)" });
      }
    } catch (e: unknown) { setStatus({ type: "error", msg: (e as Error).message }); }
    finally { setLoading(false); }
  };

  const createMarket = async () => {
    if (!addr || !question || !deadline) return;
    const dl = Math.floor(new Date(deadline).getTime() / 1000);
    if (dl <= Date.now() / 1000) return setStatus({ type: "error", msg: "Deadline must be in the future" });

    setCreating(true); setStatus(null);
    try {
      const hash = await simSignSend("create_market", [scvAddr(addr), scvStr(question), scvU64(BigInt(dl))], addr, () => setStatus({ type: "info", msg: "Confirming..." }));
      setQuestion(""); setDeadline("");
      setStatus({ type: "success", msg: "Market created!", txHash: hash });
      reloadWithDelay();
    } catch (e: unknown) { setStatus({ type: "error", msg: e instanceof Error ? e.message : String(e) }); }
    finally { setCreating(false); }
  };

  const placeBet = async (marketId: number, side: boolean) => {
    if (!addr || !betAmount || parseFloat(betAmount) <= 0) return;
    const xlm = parseFloat(betAmount);
    const amount = BigInt(Math.floor(xlm * 10_000_000));

    setPayTx("pending"); setStatus(null);
    try {
      const hash = await simSignSend("place_bet", [scvAddr(addr), scvAddr(NATIVE_TOKEN), scvU32(marketId), scvBool(side), scvI128(amount)], addr, () => setStatus({ type: "info", msg: "Confirming..." }));
      setBetAmount(""); setBetMarket(null);
      setStatus({ type: "success", msg: `Bet ${side ? "YES" : "NO"} ${xlm} XLM!`, txHash: hash });
      setPayTx("success"); setTimeout(() => setPayTx("idle"), 2000);
      reloadWithDelay();
    } catch (e: unknown) { setPayTx("fail"); setStatus({ type: "error", msg: (e as Error).message }); }
  };

  const resolveMarket = async (marketId: number, outcome: boolean) => {
    if (!addr) return;
    setPayTx("pending"); setStatus(null);
    try {
      const hash = await simSignSend("resolve_market", [scvAddr(addr), scvAddr(NATIVE_TOKEN), scvU32(marketId), scvBool(outcome)], addr, () => setStatus({ type: "info", msg: "Confirming..." }));
      setStatus({ type: "success", msg: `Resolved as ${outcome ? "YES" : "NO"}!`, txHash: hash });
      setPayTx("success"); setTimeout(() => setPayTx("idle"), 2000);
      reloadWithDelay();
    } catch (e: unknown) { setPayTx("fail"); setStatus({ type: "error", msg: (e as Error).message }); }
  };

  const claimWinnings = async (marketId: number) => {
    if (!addr) return;
    setPayTx("pending"); setStatus(null);
    try {
      const hash = await simSignSend("claim_winnings", [scvAddr(addr), scvAddr(NATIVE_TOKEN), scvU32(marketId)], addr, () => setStatus({ type: "info", msg: "Confirming..." }));
      setStatus({ type: "success", msg: "Winnings claimed!", txHash: hash });
      setPayTx("success"); setTimeout(() => setPayTx("idle"), 2000);
      reloadWithDelay();
    } catch (e: unknown) { setPayTx("fail"); setStatus({ type: "error", msg: (e as Error).message }); }
  };

  const dt = (ts: number) => new Date(ts * 1000).toLocaleDateString();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-emerald-950 to-blue-950">
      {/* WC 2026 floating stars */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-10 left-[10%] text-2xl animate-pulse">⭐</div>
        <div className="absolute top-20 right-[15%] text-xl animate-bounce">🌟</div>
        <div className="absolute bottom-20 left-[20%] text-2xl animate-pulse">✨</div>
        <div className="absolute top-1/3 right-[8%] text-xl animate-bounce">⭐</div>
        <div className="absolute bottom-1/4 right-[25%] text-2xl animate-pulse">🌟</div>
        <div className="absolute top-[15%] left-[40%] text-lg animate-bounce">✨</div>
      </div>

      {showWm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowWm(false)}>
          <div className="bg-gradient-to-br from-emerald-900 to-blue-900 border border-yellow-500/30 rounded-2xl p-6 w-full max-w-xs shadow-2xl shadow-yellow-500/10" onClick={e => e.stopPropagation()}>
            <div className="text-4xl text-center mb-3">⚽</div>
            <h3 className="text-lg font-semibold mb-4 text-center text-yellow-400">Connect Wallet</h3>
            <button onClick={connectFreighter} className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-yellow-500 hover:from-emerald-400 hover:to-yellow-400 rounded-xl p-3 transition-all font-medium text-black shadow-lg">
              <img src="/logoStellar.png" alt="" className="w-6 h-6" />
              Freighter
            </button>
          </div>
        </div>
      )}

      <nav className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-yellow-500/20 bg-gradient-to-r from-gray-900/95 via-emerald-900/95 to-blue-900/95 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/" className="text-xs sm:text-sm text-yellow-400/80 hover:text-yellow-400 transition-colors">&larr; Back</Link>
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-yellow-400 rounded-full flex items-center justify-center font-bold text-sm shadow-lg shadow-yellow-500/30 animate-bounce [animation-duration:2s]">🏆</div>
          <span className="hidden sm:inline">
            <span className="font-bold text-yellow-400">World Cup</span>
            <span className="text-emerald-300 ml-1">Prophecy</span>
          </span>
          <span className="sm:hidden font-bold text-yellow-400">WC'26</span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-600/30 to-red-600/30 rounded-full text-xs text-yellow-300 border border-yellow-500/20">
            🇺🇸🇨🇦🇲🇽 2026
          </span>
        </div>
        <div>
          {addr ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-right">
                <div className="text-xs sm:text-sm text-gray-200">{walletName} &middot; {f(addr)}</div>
                {balance !== null && <div className="text-xs text-yellow-400 text-right">{balance} XLM</div>}
              </div>
              <button onClick={() => { setAddr(null); setWalletName(""); setBalance(null); }} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Disconnect</button>
            </div>
          ) : (
            <button onClick={() => setShowWm(true)} className="bg-gradient-to-r from-emerald-500 to-yellow-500 hover:from-emerald-400 hover:to-yellow-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-all shadow-lg shadow-yellow-500/20">
              Connect ⚽
            </button>
          )}
        </div>
      </nav>

      <div className="relative max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 z-10">
        {/* Hero */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="text-5xl sm:text-6xl mb-2 animate-bounce [animation-duration:3s]">🏆</div>
          <div className="flex items-center justify-center gap-2 text-lg sm:text-xl mb-1">
            <span>🇺🇸</span><span className="text-blue-400">·</span><span>🇨🇦</span><span className="text-red-400">·</span><span>🇲🇽</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black bg-gradient-to-r from-emerald-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]">
            World Cup 2026
          </h1>
          <p className="text-yellow-400/80 text-xs sm:text-sm mt-1 font-medium">⚡ Predict · Bet · Win on Stellar Soroban ⚡</p>
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-full" />{markets.length} markets</span>
            <span className="text-gray-600">|</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400 rounded-full" />{balance || "0"} XLM</span>
          </div>
        </div>

        {addr && (
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-yellow-500/20 rounded-xl p-4 sm:p-6 mb-6 backdrop-blur-md shadow-lg shadow-yellow-500/5">
            <h2 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2 text-yellow-400">
              <span>➕</span> Create Match Market
            </h2>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <input className="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 transition-all" placeholder='e.g. Will Brazil win the 2026 World Cup?' value={question} onChange={e => setQuestion(e.target.value)} />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <input className="flex-1 bg-gray-900/80 border border-gray-700 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 transition-all" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-gray-400 bg-gray-900/80 border border-gray-700 rounded-lg whitespace-nowrap">
                  <span>Fee:</span> <span className="text-yellow-400 font-bold">2%</span>
                  <span className="text-emerald-400 ml-1">🔒 fixed</span>
                </div>
              </div>
              <button onClick={createMarket} disabled={creating || !question || !deadline} className="w-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-orange-500 hover:from-emerald-400 hover:via-yellow-400 hover:to-orange-400 text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed py-2.5 sm:py-3 rounded-lg transition-all shadow-lg shadow-yellow-500/20">
                {creating ? "⚡ Creating..." : "⚡ Create Market"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-yellow-400">
            <span>📋</span> Match Markets
            <span className="text-xs text-gray-500 font-normal">({markets.length})</span>
          </h2>
          <button onClick={loadMarkets} disabled={loading} className="text-xs sm:text-sm text-gray-400 hover:text-yellow-400 flex items-center gap-1 transition-colors disabled:opacity-50">
            {loading ? (
              <span className="flex items-center gap-1"><span className="animate-spin inline-block w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full" /> Loading...</span>
            ) : <>🔄 Refresh</>}
          </button>
        </div>

        {!addr ? (
          <div className="text-center py-16 sm:py-20">
            <div className="text-6xl mb-4 animate-bounce [animation-duration:2s]">⚽</div>
            <p className="text-yellow-400/60 text-sm font-medium">Connect wallet to join the prophecy</p>
            <p className="text-gray-600 text-xs mt-2">USA 🇺🇸 · Canada 🇨🇦 · Mexico 🇲🇽 2026</p>
          </div>
        ) : markets.length === 0 && !loading ? (
          <div className="text-center py-16 sm:py-20">
            <div className="text-6xl mb-4">🏟️</div>
            <p className="text-yellow-400/60 text-sm font-medium">No markets yet</p>
            <p className="text-gray-600 text-xs mt-2">Create the first match market above! ⚡</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {markets.map((m, idx) => {
              const myYes = m.yes_bets.find(b => b.user === addr);
              const myNo = m.no_bets.find(b => b.user === addr);
              const myBet = myYes || myNo;
              const mySide = myYes ? "YES" : myNo ? "NO" : null;
              const total = m.yes_pool + m.no_pool;
              const yesPct = total > 0 ? (m.yes_pool / total * 100) : 50;
              const isWinningBet = myBet && m.resolved && mySide === (m.outcome ? "YES" : "NO");
              const flag = FLAGS[idx % FLAGS.length];
              return (
                <div key={m.id} className="group bg-gradient-to-br from-gray-800/70 to-gray-900/70 border border-gray-700/50 hover:border-yellow-500/40 rounded-xl p-4 sm:p-5 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10 hover:-translate-y-0.5">
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-xs text-gray-500 shrink-0">#{m.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${m.resolved ? (m.outcome ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30") : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"}`}>
                          {m.resolved ? (m.outcome ? "✅ YES" : "❌ NO") : "⏳ Open"}
                        </span>
                        {m.resolved && isWinningBet && <span className="text-xs bg-gradient-to-r from-yellow-500/30 to-emerald-500/30 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30 shrink-0 animate-pulse">🏆 Winner!</span>}
                        <span className="text-sm shrink-0">{flag}</span>
                      </div>
                      <h3 className="font-bold text-sm sm:text-base text-gray-100 truncate group-hover:text-yellow-200 transition-colors">{m.question}</h3>
                      <div className="text-xs text-gray-500 mt-1 truncate flex items-center gap-2">
                        <span>📅 {dt(m.deadline)}</span>
                        <span>👤 {f(m.creator)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-2 sm:mb-3">
                    <div className="flex-1 bg-gradient-to-br from-emerald-600/15 to-emerald-800/15 border border-emerald-500/20 rounded-lg p-2 sm:p-3">
                      <div className="text-xs text-emerald-300 mb-0.5 font-medium">⚽ YES</div>
                      <div className="font-bold text-xs sm:text-sm text-emerald-200">{(m.yes_pool / 1e7).toFixed(2)} XLM</div>
                    </div>
                    <div className="flex-1 bg-gradient-to-br from-red-600/15 to-red-800/15 border border-red-500/20 rounded-lg p-2 sm:p-3">
                      <div className="text-xs text-red-300 mb-0.5 font-medium">🧤 NO</div>
                      <div className="font-bold text-xs sm:text-sm text-red-200">{(m.no_pool / 1e7).toFixed(2)} XLM</div>
                    </div>
                  </div>

                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-2 sm:mb-3 shadow-inner">
                    <div className="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-emerald-400 transition-all duration-500 rounded-full" style={{ width: `${yesPct}%` }} />
                  </div>

                  {myBet && (
                    <div className={`text-xs mb-2 sm:mb-3 px-2.5 py-1.5 rounded-lg border ${myBet.claimed ? "bg-gray-800/50 border-gray-700 text-gray-500" : isWinningBet && m.resolved ? "bg-gradient-to-r from-yellow-500/10 to-emerald-500/10 border-yellow-500/20 text-yellow-300" : "bg-gray-800/30 border-gray-700/50 text-yellow-300"}`}>
                      🎯 Your bet: <strong>{(myBet.amount / 1e7).toFixed(2)} XLM</strong> on <strong className={mySide === "YES" ? "text-emerald-400" : "text-red-400"}>{mySide}</strong>
                      {myBet.claimed ? " ✅ Claimed" : isWinningBet && m.resolved ? " — 🏆 Claim!" : ""}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {!m.resolved && addr && (
                      <>
                        <button onClick={() => { setBetMarket(m.id); setBetAmount(""); setBetSide(true); }} className="flex-1 min-w-[80px] bg-gradient-to-r from-emerald-700/60 to-emerald-600/60 hover:from-emerald-600 hover:to-emerald-500 rounded-lg py-2 text-xs sm:text-sm text-emerald-200 font-medium transition-all border border-emerald-500/20 hover:border-emerald-400/40">
                          ⚽ YES
                        </button>
                        <button onClick={() => { setBetMarket(m.id); setBetAmount(""); setBetSide(false); }} className="flex-1 min-w-[80px] bg-gradient-to-r from-red-700/60 to-red-600/60 hover:from-red-600 hover:to-red-500 rounded-lg py-2 text-xs sm:text-sm text-red-200 font-medium transition-all border border-red-500/20 hover:border-red-400/40">
                          🧤 NO
                        </button>
                      </>
                    )}
                    {m.resolved && myBet && !myBet.claimed && isWinningBet && (
                      <button onClick={() => claimWinnings(m.id)} disabled={payTx === "pending"} className="flex-1 bg-gradient-to-r from-yellow-500 to-emerald-500 hover:from-yellow-400 hover:to-emerald-400 text-black font-bold rounded-lg py-2 text-xs sm:text-sm transition-all shadow-lg shadow-yellow-500/20">
                        {payTx === "pending" ? "⏳" : "🏆 Claim Winnings"}
                      </button>
                    )}
                    {!m.resolved && addr === m.creator && Date.now() / 1000 > m.deadline && (
                      <div className="flex gap-2 w-full">
                        <button onClick={() => resolveMarket(m.id, true)} disabled={payTx === "pending"} className="flex-1 bg-emerald-700 hover:bg-emerald-600 rounded-lg py-2 text-xs sm:text-sm font-medium border border-emerald-500/30 transition-all">
                          ✅ Resolve YES
                        </button>
                        <button onClick={() => resolveMarket(m.id, false)} disabled={payTx === "pending"} className="flex-1 bg-red-700 hover:bg-red-600 rounded-lg py-2 text-xs sm:text-sm font-medium border border-red-500/30 transition-all">
                          ❌ Resolve NO
                        </button>
                      </div>
                    )}
                  </div>

                  {betMarket === m.id && (
                    <div className="mt-3 pt-3 border-t border-gray-700/50 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                      <input className="flex-1 bg-gray-900/80 border border-yellow-500/30 rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 transition-all" type="number" step="0.0000001" min="0.0000001" placeholder="Amount XLM" value={betAmount} onChange={e => setBetAmount(e.target.value)} />
                      <div className="flex gap-2 items-center">
                        <span className={`text-xs font-bold px-2.5 py-1.5 rounded ${betSide ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/30" : "bg-red-600/30 text-red-300 border border-red-500/30"}`}>
                          {betSide ? "⚽ YES" : "🧤 NO"}
                        </span>
                        <button onClick={() => placeBet(m.id, betSide)} disabled={payTx === "pending" || !betAmount || parseFloat(betAmount) <= 0} className={`px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all disabled:opacity-40 ${betSide ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30" : "bg-red-600 hover:bg-red-500 shadow-red-600/30"} shadow-lg`}>
                          {payTx === "pending" ? "⏳" : "⚡ Bet"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {status && (
        <div className={`fixed bottom-3 sm:bottom-4 left-2 sm:left-1/2 sm:-translate-x-1/2 right-2 sm:right-auto mx-auto max-w-md px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-2xl backdrop-blur-md z-50 ${status.type === "success" ? "bg-emerald-700/90 text-white border border-emerald-500/30" : status.type === "error" ? "bg-red-700/90 text-white border border-red-500/30" : "bg-blue-700/90 text-white border border-blue-500/30"}`}>
          <span className="flex-1">{status.type === "success" ? "✅ " : status.type === "error" ? "❌ " : "ℹ️ "}{status.msg}</span>
          {status.txHash && <a href={`${EXPLORER}/tx/${status.txHash}`} target="_blank" rel="noopener" className="underline shrink-0 text-yellow-300 hover:text-yellow-200">TX ↗</a>}
          <button onClick={() => setStatus(null)} className="shrink-0 text-white/50 hover:text-white text-base leading-none ml-1">✕</button>
        </div>
      )}
    </div>
  );
}
