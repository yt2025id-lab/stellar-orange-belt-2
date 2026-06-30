import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { isConnected, getAddress, requestAccess, signTransaction } from "@stellar/freighter-api";
import { Horizon, TransactionBuilder, Networks, xdr, Keypair, Operation, Address } from "stellar-sdk";

const HORIZON_URL = import.meta.env.VITE_HORIZON_URL || "https://horizon-testnet.stellar.org";
const RPC_URL = import.meta.env.VITE_RPC_URL || "https://soroban-testnet.stellar.org";
const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const NATIVE_TOKEN = import.meta.env.VITE_NATIVE_TOKEN || "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const EXPLORER = "https://stellar.expert/explorer/testnet";

const server = new Horizon.Server(HORIZON_URL);
type TxState = "idle" | "pending" | "success" | "fail";

function scvAddr(a: string): xdr.ScVal { return new Address(a).toScVal(); }
function scvStr(s: string): xdr.ScVal { return xdr.ScVal.scvString(s); }
function scvI128(n: bigint): xdr.ScVal { return xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: new xdr.Int64(BigInt.asIntN(64, n >> 64n)), lo: new xdr.Uint64(BigInt.asUintN(64, n)) })); }
function scvU32(n: number): xdr.ScVal { return xdr.ScVal.scvU32(n); }
function scvU64(n: bigint): xdr.ScVal { return xdr.ScVal.scvU64(new xdr.Uint64(n)); }
function scvBool(b: boolean): xdr.ScVal { return xdr.ScVal.scvBool(b); }
function f(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }

interface Bet { user: string; amount: number; claimed: boolean; }
interface Market {
  id: number; creator: string; question: string; deadline: number;
  resolved: boolean; outcome: boolean; resolved_at: number;
  yes_pool: number; no_pool: number; yes_bets: Bet[]; no_bets: Bet[];
}

async function rpc(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await fetch(RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const d = await r.json(); if (d.error) throw new Error(d.error.message ?? JSON.stringify(d.error));
  return d.result as Record<string, unknown>;
}

function parseBet(m: any): Bet | null {
  const fields: Record<string, xdr.ScVal> = {};
  for (let i = 0; i < m.length; i++) {
    try { const k = m[i].key().sym()?.toString() || ""; if (!k) continue; const v = m[i].val(); if (v) fields[k] = v; } catch {}
  }
  const addr = (s: xdr.ScVal | undefined) => { try { return s ? Address.fromScVal(s).toString() : ""; } catch { return ""; } };
  return { user: addr(fields.user), amount: Number(fields.amount?.i128()?.lo ?? 0n), claimed: (fields.claimed as any)?.bool?.() ?? ((fields.claimed as any)?.u32?.() ?? 0) !== 0 };
}

function parseMarket(entries: any[], id: number): Market | null {
  const fields: Record<string, xdr.ScVal> = {};
  for (let i = 0; i < entries.length; i++) {
    try { const k = entries[i].key().sym()?.toString() || ""; if (!k) continue; const v = entries[i].val(); if (v) fields[k] = v; } catch {}
  }
  const addr = (s: xdr.ScVal | undefined) => { try { return s ? Address.fromScVal(s).toString() : ""; } catch { return ""; } };
  const yesBets: Bet[] = []; const noBets: Bet[] = [];
  if (fields.yes_bets) { let v; try { v = fields.yes_bets.vec(); } catch {} if (v) for (const b of v) { let mv; try { mv = b.map(); } catch {} if (mv) { const pb = parseBet(mv); if (pb) yesBets.push(pb); } } }
  if (fields.no_bets) { let v; try { v = fields.no_bets.vec(); } catch {} if (v) for (const b of v) { let mv; try { mv = b.map(); } catch {} if (mv) { const pb = parseBet(mv); if (pb) noBets.push(pb); } } }
  return {
    id, creator: addr(fields.creator), question: fields.question?.str()?.toString() ?? "",
    deadline: Number(fields.deadline?.u64()?.toString() ?? "0"),
    resolved: ((fields.resolved as any)?.bool?.() ?? false), outcome: ((fields.outcome as any)?.bool?.() ?? false),
    resolved_at: Number(fields.resolved_at?.u64()?.toString() ?? "0"),
    yes_pool: Number(fields.yes_pool?.i128()?.lo ?? 0n), no_pool: Number(fields.no_pool?.i128()?.lo ?? 0n),
    yes_bets: yesBets, no_bets: noBets,
  };
}

export default function Dashboard() {
  const [addr, setAddr] = useState<string | null>(null);
  const [walletName, setWalletName] = useState("");
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

  useEffect(() => { isConnected().then(r => { if (r.isConnected) getAddress().then(({ address: a }) => { setAddr(a); setWalletName("Freighter"); }); }).catch(() => {}); }, []);

  const connectFreighter = async () => {
    const { address: a, error: e } = await requestAccess();
    if (e || !a) { setStatus({ type: "error", msg: "Install Freighter extension." }); return; }
    setAddr(a); setWalletName("Freighter"); setShowWm(false);
  };

  const loadMarkets = async () => {
    setLoading(true); setStatus(null);
    try {
      const acct = new (require("stellar-sdk").Account)((await isConnected()).isConnected ? (await getAddress()).address : Keypair.random().publicKey(), "0");
      const raw = new TransactionBuilder(acct, { fee: "100", networkPassphrase: Networks.TESTNET })
        .addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: "get_markets", args: [] }))
        .setTimeout(300).build();
      const sim = await rpc("simulateTransaction", { transaction: raw.toXDR() }) as unknown as { results?: Array<{ xdr?: string }>; error?: string };
      if (!sim.results?.[0]?.xdr) { setMarkets([]); setStatus({ type: "success", msg: "No markets yet" }); return; }
      const rv = xdr.ScVal.fromXDR(sim.results[0].xdr, "base64");
      const vec = rv.vec();
      if (!vec) { setMarkets([]); return; }
      const parsed: Market[] = [];
      for (let i = 0; i < vec.length; i++) {
        const m = vec[i].map(); if (!m) continue;
        const market = parseMarket(m, i); if (market) parsed.push(market);
      }
      setMarkets(parsed);
      setStatus({ type: "success", msg: `${parsed.length} market${parsed.length !== 1 ? "s" : ""} loaded` });
    } catch (e: unknown) { setStatus({ type: "error", msg: (e as Error).message }); }
    finally { setLoading(false); }
  };

  const createMarket = async () => {
    if (!addr || !question || !deadline) return;
    const dl = Math.floor(new Date(deadline).getTime() / 1000);
    if (dl <= Date.now() / 1000) return setStatus({ type: "error", msg: "Deadline must be in the future" });

    setCreating(true); setStatus(null);
    try {
      const acct = await server.loadAccount(addr);
      const raw = new TransactionBuilder(acct, { fee: "100000", networkPassphrase: Networks.TESTNET })
        .addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: "create_market", args: [scvAddr(addr), scvStr(question), scvU64(BigInt(dl))] }))
        .setTimeout(300).build();
      const sim = await rpc("simulateTransaction", { transaction: raw.toXDR() }) as unknown as { minResourceFee: string; transactionData: string; results?: Array<{ auth?: string[] }> };
      const fee = (parseInt(raw.fee, 10) + parseInt(sim.minResourceFee || "0", 10)).toString();
      const sd = xdr.SorobanTransactionData.fromXDR(sim.transactionData, "base64");
      const fresh = await server.loadAccount(addr);
      const tx = new TransactionBuilder(fresh, { fee, networkPassphrase: Networks.TESTNET, sorobanData: sd })
        .addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: "create_market", args: [scvAddr(addr), scvStr(question), scvU64(BigInt(dl))] }))
        .setTimeout(300).build();
      const { signedTxXdr } = await signTransaction(tx.toXDR(), { networkPassphrase: Networks.TESTNET, address: addr });
      const send = await rpc("sendTransaction", { transaction: signedTxXdr }) as unknown as { hash: string; errorResult?: string };
      if (send.errorResult) throw new Error(`TX failed: ${send.errorResult}`);
      for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 1000)); const st = await rpc("getTransaction", { hash: send.hash }) as { status: string }; if (st.status === "SUCCESS") break; }
      setQuestion(""); setDeadline("");
      setStatus({ type: "success", msg: "Market created!", txHash: send.hash });
      loadMarkets();
    } catch (e: unknown) { setStatus({ type: "error", msg: (e as Error).message }); }
    finally { setCreating(false); }
  };

  const placeBet = async (marketId: number, side: boolean) => {
    if (!addr || !betAmount) return;
    const amount = BigInt(betAmount);
    if (amount <= 0) return;

    setPayTx("pending"); setStatus(null);
    try {
      const acct = await server.loadAccount(addr);
      const raw = new TransactionBuilder(acct, { fee: "100000", networkPassphrase: Networks.TESTNET })
        .addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: "place_bet", args: [scvAddr(addr), scvAddr(NATIVE_TOKEN), scvU32(marketId), scvBool(side), scvI128(amount)] }))
        .setTimeout(300).build();
      const sim = await rpc("simulateTransaction", { transaction: raw.toXDR() }) as unknown as { minResourceFee: string; transactionData: string };
      const fee = (parseInt(raw.fee, 10) + parseInt(sim.minResourceFee || "0", 10)).toString();
      const sd = xdr.SorobanTransactionData.fromXDR(sim.transactionData, "base64");
      const fresh = await server.loadAccount(addr);
      const tx = new TransactionBuilder(fresh, { fee, networkPassphrase: Networks.TESTNET, sorobanData: sd })
        .addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: "place_bet", args: [scvAddr(addr), scvAddr(NATIVE_TOKEN), scvU32(marketId), scvBool(side), scvI128(amount)] }))
        .setTimeout(300).build();
      const { signedTxXdr } = await signTransaction(tx.toXDR(), { networkPassphrase: Networks.TESTNET, address: addr });
      const send = await rpc("sendTransaction", { transaction: signedTxXdr }) as unknown as { hash: string; errorResult?: string };
      if (send.errorResult) throw new Error(`TX failed: ${send.errorResult}`);
      for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 1000)); const st = await rpc("getTransaction", { hash: send.hash }) as { status: string }; if (st.status === "SUCCESS") break; }
      setBetAmount(""); setBetMarket(null);
      setStatus({ type: "success", msg: `Bet ${side ? "YES" : "NO"} ${amount} stroops!`, txHash: send.hash });
      setPayTx("success"); setTimeout(() => setPayTx("idle"), 2000);
      loadMarkets();
    } catch (e: unknown) { setPayTx("fail"); setStatus({ type: "error", msg: (e as Error).message }); }
  };

  const resolveMarket = async (marketId: number, outcome: boolean) => {
    if (!addr) return;
    setPayTx("pending"); setStatus(null);
    try {
      const acct = await server.loadAccount(addr);
      const raw = new TransactionBuilder(acct, { fee: "100000", networkPassphrase: Networks.TESTNET })
        .addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: "resolve_market", args: [scvAddr(addr), scvAddr(NATIVE_TOKEN), scvU32(marketId), scvBool(outcome)] }))
        .setTimeout(300).build();
      const sim = await rpc("simulateTransaction", { transaction: raw.toXDR() }) as unknown as { minResourceFee: string; transactionData: string };
      const fee = (parseInt(raw.fee, 10) + parseInt(sim.minResourceFee || "0", 10)).toString();
      const sd = xdr.SorobanTransactionData.fromXDR(sim.transactionData, "base64");
      const fresh = await server.loadAccount(addr);
      const tx = new TransactionBuilder(fresh, { fee, networkPassphrase: Networks.TESTNET, sorobanData: sd })
        .addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: "resolve_market", args: [scvAddr(addr), scvAddr(NATIVE_TOKEN), scvU32(marketId), scvBool(outcome)] }))
        .setTimeout(300).build();
      const { signedTxXdr } = await signTransaction(tx.toXDR(), { networkPassphrase: Networks.TESTNET, address: addr });
      const send = await rpc("sendTransaction", { transaction: signedTxXdr }) as unknown as { hash: string; errorResult?: string };
      if (send.errorResult) throw new Error(`TX failed: ${send.errorResult}`);
      for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 1000)); const st = await rpc("getTransaction", { hash: send.hash }) as { status: string }; if (st.status === "SUCCESS") break; }
      setStatus({ type: "success", msg: `Resolved as ${outcome ? "YES" : "NO"}!`, txHash: send.hash });
      setPayTx("success"); setTimeout(() => setPayTx("idle"), 2000);
      loadMarkets();
    } catch (e: unknown) { setPayTx("fail"); setStatus({ type: "error", msg: (e as Error).message }); }
  };

  const claimWinnings = async (marketId: number) => {
    if (!addr) return;
    setPayTx("pending"); setStatus(null);
    try {
      const acct = await server.loadAccount(addr);
      const raw = new TransactionBuilder(acct, { fee: "100000", networkPassphrase: Networks.TESTNET })
        .addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: "claim_winnings", args: [scvAddr(addr), scvAddr(NATIVE_TOKEN), scvU32(marketId)] }))
        .setTimeout(300).build();
      const sim = await rpc("simulateTransaction", { transaction: raw.toXDR() }) as unknown as { minResourceFee: string; transactionData: string };
      const fee = (parseInt(raw.fee, 10) + parseInt(sim.minResourceFee || "0", 10)).toString();
      const sd = xdr.SorobanTransactionData.fromXDR(sim.transactionData, "base64");
      const fresh = await server.loadAccount(addr);
      const tx = new TransactionBuilder(fresh, { fee, networkPassphrase: Networks.TESTNET, sorobanData: sd })
        .addOperation(Operation.invokeContractFunction({ contract: CONTRACT_ID, function: "claim_winnings", args: [scvAddr(addr), scvAddr(NATIVE_TOKEN), scvU32(marketId)] }))
        .setTimeout(300).build();
      const { signedTxXdr } = await signTransaction(tx.toXDR(), { networkPassphrase: Networks.TESTNET, address: addr });
      const send = await rpc("sendTransaction", { transaction: signedTxXdr }) as unknown as { hash: string; errorResult?: string };
      if (send.errorResult) throw new Error(`TX failed: ${send.errorResult}`);
      for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 1000)); const st = await rpc("getTransaction", { hash: send.hash }) as { status: string }; if (st.status === "SUCCESS") break; }
      setStatus({ type: "success", msg: "Winnings claimed!", txHash: send.hash });
      setPayTx("success"); setTimeout(() => setPayTx("idle"), 2000);
      loadMarkets();
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
              <span className="text-sm text-gray-400">{walletName} · {f(addr)}</span>
              <button onClick={() => { setAddr(null); setWalletName(""); }} className="text-xs text-gray-500 hover:text-white">Disconnect</button>
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
                {creating ? "Creating…" : "Create Market"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Markets</h2>
          <button onClick={loadMarkets} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
            {loading ? "Loading…" : "↻ Refresh"}
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
                  <div className="text-xs text-gray-500 mt-1">Deadline: {dt(m.deadline)} · by {f(m.creator)}</div>
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
                    <button onClick={() => { setBetMarket(m.id); setBetAmount(""); }} className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-lg py-2 text-sm text-green-400 font-medium transition-colors">Bet YES</button>
                    <button onClick={() => { setBetMarket(m.id); setBetAmount(""); }} className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-lg py-2 text-sm text-red-400 font-medium transition-colors">Bet NO</button>
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
                <div className="mt-3 flex gap-2">
                  <input className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" type="number" placeholder="Amount (stroops)" value={betAmount} onChange={e => setBetAmount(e.target.value)} />
                  <button onClick={() => placeBet(m.id, true)} disabled={payTx === "pending"} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium">YES</button>
                  <button onClick={() => placeBet(m.id, false)} disabled={payTx === "pending"} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium">NO</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {status && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg ${status.type === "success" ? "bg-green-600" : status.type === "error" ? "bg-red-600" : "bg-gray-800"}`}>
          {status.msg}
          {status.txHash && <a href={`${EXPLORER}/tx/${status.txHash}`} target="_blank" rel="noopener" className="underline">TX &nearr;</a>}
        </div>
      )}
    </div>
  );
}
