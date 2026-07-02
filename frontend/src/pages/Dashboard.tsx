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

  if (sim.error) throw new Error(`Simulation RPC error: ${sim.error as string}`);
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
        setStatus({ type: "success", msg: `${parsed.length} market${parsed.length !== 1 ? "s" : ""} loaded` });
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
    <div className="min-h-screen">
      {showWm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowWm(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Connect Wallet</h3>
            <button onClick={connectFreighter} className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-xl p-3 transition-colors">
              <img src="/logoStellar.png" alt="" className="w-6 h-6" />
              <span>Freighter</span>
            </button>
          </div>
        </div>
      )}

      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-gray-400 hover:text-white">&larr; Back</Link>
          <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center font-bold text-xs">P</div>
          <span className="font-semibold">Stellar Prophecy</span>
        </div>
        <div>
          {addr ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm">{walletName} &middot; {f(addr)}</div>
                {balance !== null && <div className="text-xs text-purple-400">{balance} XLM</div>}
              </div>
              <button onClick={() => { setAddr(null); setWalletName(""); setBalance(null); }} className="text-xs text-gray-500 hover:text-white">Disconnect</button>
            </div>
          ) : (
            <button onClick={() => setShowWm(true)} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {addr && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Create Market</h2>
            <div className="space-y-4">
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500" placeholder="Question (e.g. Will BTC hit $100K by 2026?)" value={question} onChange={e => setQuestion(e.target.value)} />
              <div className="flex gap-3">
                <input className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400 bg-gray-800 border border-gray-700 rounded-lg">
                  Fee: <span className="text-white">2% (fixed)</span>
                </div>
              </div>
              <button onClick={createMarket} disabled={creating || !question || !deadline} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-medium transition-colors">
                {creating ? "Creating..." : "Create Market"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Markets</h2>
          <button onClick={loadMarkets} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
            {loading ? "Loading..." : "\u21bb Refresh"}
          </button>
        </div>

        {!addr ? (
          <div className="text-center text-gray-500 py-12">Connect wallet to view and create markets.</div>
        ) : markets.length === 0 && !loading ? (
          <div className="text-center text-gray-500 py-12">No markets yet. Create one above!</div>
        ) : markets.map(m => {
          const myYes = m.yes_bets.find(b => b.user === addr);
          const myNo = m.no_bets.find(b => b.user === addr);
          const myBet = myYes || myNo;
          const mySide = myYes ? "YES" : myNo ? "NO" : null;
          const total = m.yes_pool + m.no_pool;
          const yesPct = total > 0 ? (m.yes_pool / total * 100) : 50;
          return (
            <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">#{m.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.resolved ? (m.outcome ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400") : "bg-yellow-600/20 text-yellow-400"}`}>
                      {m.resolved ? `Resolved: ${m.outcome ? "YES" : "NO"}` : "Active"}
                    </span>
                  </div>
                  <h3 className="font-semibold">{m.question}</h3>
                  <div className="text-xs text-gray-500 mt-1">Deadline: {dt(m.deadline)} &middot; by {f(m.creator)}</div>
                </div>
              </div>

              <div className="flex gap-2 mb-3">
                <div className="flex-1 bg-green-600/10 border border-green-600/20 rounded-lg p-3">
                  <div className="text-xs text-green-400 mb-1">YES Pool</div>
                  <div className="font-semibold">{(m.yes_pool / 1e7).toFixed(4)} XLM</div>
                </div>
                <div className="flex-1 bg-red-600/10 border border-red-600/20 rounded-lg p-3">
                  <div className="text-xs text-red-400 mb-1">NO Pool</div>
                  <div className="font-semibold">{(m.no_pool / 1e7).toFixed(4)} XLM</div>
                </div>
              </div>

              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${yesPct}%` }} />
              </div>

              {myBet && (
                <div className={`text-xs mb-3 ${myBet.claimed ? "text-gray-500" : (mySide === (m.outcome ? "YES" : "NO") && m.resolved ? "text-green-400" : "text-yellow-400")}`}>
                  Your bet: {(myBet.amount / 1e7).toFixed(4)} XLM on {mySide}{myBet.claimed ? " (claimed)" : ""}
                </div>
              )}

              <div className="flex gap-2">
                {!m.resolved && addr && (
                  <>
                    <button onClick={() => { setBetMarket(m.id); setBetAmount(""); setBetSide(true); }} className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-lg py-2 text-sm text-green-400 font-medium transition-colors">Bet YES</button>
                    <button onClick={() => { setBetMarket(m.id); setBetAmount(""); setBetSide(false); }} className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-lg py-2 text-sm text-red-400 font-medium transition-colors">Bet NO</button>
                  </>
                )}
                {m.resolved && myBet && !myBet.claimed && mySide === (m.outcome ? "YES" : "NO") && (
                  <button onClick={() => claimWinnings(m.id)} disabled={payTx === "pending"} className="flex-1 bg-purple-600 hover:bg-purple-700 rounded-lg py-2 text-sm font-medium transition-colors">
                    Claim Winnings
                  </button>
                )}
                {!m.resolved && addr === m.creator && Date.now() / 1000 > m.deadline && (
                  <div className="flex gap-2 w-full">
                    <button onClick={() => resolveMarket(m.id, true)} disabled={payTx === "pending"} className="flex-1 bg-green-600 hover:bg-green-700 rounded-lg py-2 text-sm font-medium">Resolve YES</button>
                    <button onClick={() => resolveMarket(m.id, false)} disabled={payTx === "pending"} className="flex-1 bg-red-600 hover:bg-red-700 rounded-lg py-2 text-sm font-medium">Resolve NO</button>
                  </div>
                )}
              </div>

              {betMarket === m.id && (
                <div className="mt-3 flex gap-2 items-center">
                  <input className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" type="number" step="0.0000001" min="0.0000001" placeholder="Amount (XLM)" value={betAmount} onChange={e => setBetAmount(e.target.value)} />
                  <span className="text-xs text-gray-400">{betSide ? "YES" : "NO"}</span>
                  <button onClick={() => placeBet(m.id, betSide)} disabled={payTx === "pending"} className={`px-4 py-2 rounded-lg text-sm font-medium ${betSide ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
                    {payTx === "pending" ? "Sending..." : "Confirm"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {status && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg ${status.type === "success" ? "bg-green-600" : status.type === "error" ? "bg-red-600" : "bg-blue-600"}`}>
          {status.msg}
          {status.txHash && <a href={`${EXPLORER}/tx/${status.txHash}`} target="_blank" rel="noopener" className="underline">TX &nearr;</a>}
        </div>
      )}
    </div>
  );
}
