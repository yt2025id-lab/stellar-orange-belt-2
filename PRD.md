# Stellar Prophecy — Prediction Market dApp

## Product Requirements Document v1.0

**Project:** Stellar Orange Belt — Level 3  
**Builder:** Ozan_OnChain  
**Date:** June 30, 2026  
**Stack:** Rust/Soroban SDK v22 · React 19 + Vite · Tailwind 4 · Freighter · GitHub Actions · Vercel

---

## 1. Executive Summary

**Stellar Prophecy** is a decentralized binary prediction market on Stellar Soroban. Anyone can create a YES/NO market with a question and deadline. Participants bet XLM on either side. After the deadline, the creator resolves the market based on real-world facts. Winners split the losing pool (minus 2% protocol fee to creator). Losers walk away empty. Fee is hardcoded at 2% — trustless, simple, no rug-pull possible.

**Core differentiator:** 1 contract. 1 deploy. 1 TX per action. Zero moving parts.

### Why This Works (vs Split Bill's Failure)

| Split Bill Failure Mode | How This Avoids It |
|------------------------|-------------------|
| `createCustomContract` per bill → 3 TX sequential | 1 contract, 0 deploys after initial |
| Complex sorobanData footprint per vault | Static storage — all markets in 1 contract |
| Auth: appKP + Freighter dual-flow | 1 auth source: Freighter wallet |
| `wasm-opt -O3` write path corruption | `wasm-opt -Os` verified working |
| Share link `?vault=VAULT_ID` fragile | Market ID is just a `u32` index |

---

## 2. Product Scope

### MVP (Orange Belt Submission)

| Feature | Priority |
|---------|----------|
| Create market (question + deadline + fee %) | P0 |
| Bet YES/NO with XLM | P0 |
| Creator resolve market | P0 |
| Winners claim rewards | P0 |
| Market list (all + user's markets) | P0 |
| Multi-wallet (Freighter + Albedo) | P1 |
| Mobile responsive | P1 |
| Events: created, bet, resolved, claimed | P1 |

### NOT in MVP

- Automated oracle resolution (manual creator resolve only)
- Multi-outcome markets (only YES/NO)
- LP rewards or fee sharing
- Email/SMS notifications

---

## 3. Smart Contract Architecture

### 3.1 Data Model

```rust
const PROTOCOL_FEE_BPS: i128 = 200;  // 2% = 200 basis points, hardcoded

#[contracttype]
pub struct Bet {
    pub user: Address,
    pub side: bool,      // true = YES, false = NO
    pub amount: i128,    // in stroops
    pub claimed: bool,   // prevent double-claim
}

#[contracttype]
pub struct Market {
    pub id: u32,
    pub creator: Address,
    pub question: String,       // "Will BTC hit $100K by Dec 2025?"
    pub deadline: u64,          // Unix timestamp (ledger timestamp)
    pub resolved: bool,
    pub outcome: bool,          // true = YES won, false = NO won (only valid when resolved)
    pub resolved_at: u64,       // When resolved (ledger timestamp)
    pub yes_pool: i128,         // Total XLM bet on YES (stroops)
    pub no_pool: i128,          // Total XLM bet on NO (stroops)
    pub yes_bets: Vec<Bet>,     // All YES bets (for claim calc)
    pub no_bets: Vec<Bet>,      // All NO bets (for claim calc)
}
```

Storage layout:
```
markets       → Vec<Market>           (all markets, instance storage)
market_count  → u32                   (auto-increment id)
user_bets     → Map<u32, Vec<Bet>>    (per-user per-market, persistent)
```

### 3.2 Functions

| Function | Params | Auth | Description |
|----------|--------|------|-------------|
| `__constructor` | — | — | Create empty markets vector + counter |
| `create_market` | question, deadline | `creator.require_auth()` | Create market. Creator pays 5 XLM creation fee via SAC `transfer` to contract (prevents spam). Fee hardcoded at 2%. |
| `place_bet` | market_id, side (YES/NO), amount | `user.require_auth()` | SAC `transfer` XLM from user to contract. Add bet to pool. Exact amount sent, no change returned. |
| `resolve_market` | market_id, outcome | `creator.require_auth()` | Only after `deadline`. Set `outcome`, `resolved = true`, `resolved_at = now()`. Creator receives protocol fee (2% of losing pool) via SAC transfer. |
| `claim_winnings` | market_id | `user.require_auth()` | Only if `resolved`. User must have bet on winning side and not already claimed. Send `(bet + share_of_losing_pool)` via SAC. Mark bet as `claimed`. |
| `get_market` | market_id | — | Return Market struct |
| `get_markets` | — | — | Return `Vec<Market>` (all) |
| `get_market_count` | — | — | Return `u32` |
| `get_user_bets` | user, market_id | — | Return user's `Vec<Bet>` for a market |

### 3.3 Core Logic — Claim Calculation

```rust
// Hardcoded constants
const PROTOCOL_FEE_BPS: i128 = 200;  // 2%
const CREATION_FEE_STROOPS: i128 = 50_000_000;  // 5 XLM

// Claim formula (integer-safe: multiply BEFORE divide)
let fee = losing_pool * PROTOCOL_FEE_BPS / 10_000;
let distributable = losing_pool - fee;
let reward = bet_amount + (distributable * bet_amount) / winning_pool;
// Creator receives: fee
// Winner receives: reward
// Loser receives: 0
```

**Example (all values in stroops, 1 XLM = 10^7 stroops):**
```
YES pool: 500 | NO pool: 300 | Fee: 2% | Outcome: YES wins

Winning pool (YES) = 500 stroops
Losing pool (NO)   = 300 stroops
Protocol fee (2%)   = 300 * 200 / 10000 = 6 stroops → sent to creator
Distributable       = 300 - 6 = 294 stroops

Alice bet 100 on YES → 100 + (294 * 100 / 500) = 100 + 58 = 158 stroops ✓
Bob bet 50 on NO    → 0 stroops (wrong side) ✓
Creator earns:      6 stroops (fee) ✓
```

### 3.4 Edge Cases

| Case | Handling |
|------|----------|
| One side has 0 bets | resolve still works. Winning bettors just get original bet back (distributable = 0). Creator gets 0 fee. |
| Resolve before deadline | Reject: `panic!("Deadline not reached")` |
| Double resolve | Reject: `panic!("Already resolved")` |
| Claim without resolve | Reject: `panic!("Not resolved")` |
| Claim on losing side | Reject: `panic!("Not on winning side")` |
| Claim twice | Reject: `bet.claimed` flag prevents double-claim |
| Duplicate bet by same user on same side | Accumulate amount in existing Bet entry |
| Empty question | Reject |
| Deadline in past | Reject |
| Zero bet amount | Reject |

---

## 4. Frontend Architecture

### 4.1 Pages

```
/                   → Landing (hero + CTA)
/app               → Dashboard (all markets + create form)
```

### 4.2 Dashboard Layout

```
┌─────────────────────────────────────────────┐
│  ← Back    Stellar Prophecy    [Connect]     │
├─────────────────────────────────────────────┤
│  Wallet: Freighter · GABC…xyz · 100 XLM     │
├─────────────────────────────────────────────┤
│  📝 Create Market                            │
│  ┌─────────────────────────────────┐        │
│  │ Question: ____________________  │        │
│  │ Deadline: [date picker]         │        │
│  │ Fee: 2% (fixed)                 │        │
│  │         [ 🚀 Create Market ]    │        │
│  └─────────────────────────────────┘        │
├─────────────────────────────────────────────┤
│  🔥 Live Markets                    [Refresh]│
│                                              │
│  ┌─ Market #3 ─────────────────────────┐    │
│  │ "Will ETH flip BTC by July?"        │    │
│  │ Deadline: in 5 days · Fee: 2%        │    │
│  │ [============60%========] YES: 600   │    │
│  │ [======40%=======] NO: 400           │    │
│  │ Your bet: —                           │    │
│  │ [ 100 XLM YES ] [ 100 XLM NO ]       │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌─ Market #2 ─────────────────────────┐    │
│  │ "Will SOL > $500 by Dec?"           │    │
│  │ Status: RESOLVED — YES won!          │    │
│  │ Your bet: 50 YES ✓                   │    │
│  │ You won: 85.3 XLM                    │    │
│  │ [ 💰 Claim Winnings ]               │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌─ Market #1 ─────────────────────────┐    │
│  │ "Will BTC < $10K?"                  │    │
│  │ Status: RESOLVED — NO won            │    │
│  │ Your bet: 100 YES ✗ (lost)          │    │
│  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 4.3 Critical Data Flow (Lesson from Split Bill)

```typescript
// ✅ Load markets — 1 RPC call
async function loadMarkets() {
  // 1. Simulate get_markets() — returns Vec<Market> as ScVec of ScMap
  // 2. Parse each Market
  // 3. For user's markets, find their bets
  //    (optional: call get_user_bets for active markets)
  setMarkets(parsed);
}

// ✅ Place bet — 1 TX via Freighter  
async function placeBet(marketId, side, amount) {
  // 1. Simulate place_bet
  // 2. Build TX with sorobanData from sim
  // 3. signTransaction via Freighter (handles auth + envelope)
  // 4. Poll for success
}

// ✅ Create market — 1 TX via Freighter
async function createMarket(question, deadline, feeBps) {
  // 1. Simulate create_market
  // 2. Build TX with sorobanData  
  // 3. signTransaction via Freighter
  // 4. Poll for success
}
```

**Key difference from Split Bill:** NO `deployVault`, NO `createCustomContract`, NO 3-step sequential TXs. Every action is 1 TX. Auth is ALWAYS Freighter (user pays own fees via wallet — no `appKP`).

### 4.4 Error Handling

```typescript
type TxState = "idle" | "pending" | "success" | "fail";
const [txState, setTxState] = useState<TxState>("idle");
const [status, setStatus] = useState<{type:string, msg:string, txHash?:string}|null>(null);

// Every function:
// setTxState("pending") → try → setTxState("success") / catch → setTxState("fail")
// Show status bar with TX explorer link
```

---

## 5. Testing Strategy

### 5.1 Contract Tests (~12 tests)

```
create_market:
  ✅ creates with correct fields
  ✅ rejects empty question
  ✅ rejects past deadline

place_bet:
  ✅ YES bet updates pool correctly
  ✅ NO bet updates pool correctly
  ✅ rejects on resolved market
  ✅ rejects after deadline

resolve_market:
  ✅ sets outcome + resolved
  ✅ rejects before deadline
  ✅ rejects on already resolved

claim_winnings:
  ✅ winning bettor receives correct share
  ✅ losing bettor panics
  ✅ rejects unresolved market

get_markets / get_user_bets:
  ✅ returns correct data
```

### 5.2 CI/CD Test Matrix

```yaml
# .github/workflows/ci.yml
jobs:
  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - cargo test --verbose     # ~12 tests

  contract-build:
    needs: contract-tests
    steps:
      - cargo build --release --target wasm32-unknown-unknown
      - wasm-opt -Os ...
      - Upload WASM artifacts
```

---

## 6. Deployment Plan

### 6.1 Build Pipeline

```bash
# 1. Build WASM
cargo build --release --target wasm32-unknown-unknown

# 2. Optimize with wasm-opt (strips reference-types, preserves logic)
wasm-opt -Os \
  -o target/prediction_market.wasm \
  target/wasm32-unknown-unknown/release/prediction_market.wasm

# 3. Verify no reference-types or other unsupported features
wasm-tools validate target/prediction_market.wasm --features bulk-memory,sign-ext

# 4. Upload to testnet
# 5. Deploy 1 instance via createCustomContract
# 6. Update .env with contract address
# 7. Deploy frontend to Vercel
```

### 6.2 WASM hashes to track

| Artifact | SHA-256 |
|----------|---------|
| `prediction_market.wasm` | `{hash_after_os}` |

---

## 7. Submission Checklist

| # | Requirement | Evidence |
|---|-------------|----------|
| 1 | Smart contract development | 1 contract: all market logic + SAC transfers |
| 2 | Inter-contract communication | SAC `token::Client::transfer` for bets + claims |
| 3 | Event streaming | `market_created`, `bet_placed`, `market_resolved`, `winnings_claimed` |
| 4 | CI/CD pipeline | GitHub Actions: test → build → WASM artifact |
| 5 | Contract deployment | WASM uploaded + deployed to testnet |
| 6 | Mobile responsive | Tailwind 4, mobile-first |
| 7 | Error handling | try/catch + status bar + TX explorer |
| 8 | Tests | ~12 contract tests |
| 9 | Production practices | .env vars, Freighter auth, Vercel deploy |
| 10 | Documentation | This PRD + README + screenshots |

---

## 8. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| wasm-opt corrupts contract | Medium | High | Use `-Os` (proven), verify with 12 tests |
| Freighter TX fails | Medium | High | Pure Freighter flow, user is source account — no appKP dual-auth |
| SAC transfer auth mismatch | Low | High | Freighter signs TX envelope. Auth entries unsigned → Freighter `signTransaction` handles them |
| Integer division precision loss | Medium | High | **Multiply before divide** (`bet * distributable / pool`), verified in tests |
| Frontend state inconsistency | Low | Medium | 1 RPC to load all markets with embedded bet data |
| Double-claim exploit | Low | High | `Bet.claimed` bool flag, checked in `claim_winnings` |

---

## 9. Timeline

| Phase | Time | Deliverable |
|-------|------|-------------|
| PRD audit + fix | ✅ Done | This document |
| Contract | 1.5h | lib.rs + test.rs (~12 tests) |
| WASM build | 15m | Build + optimize + upload |
| Frontend | 3h | Dashboard.tsx (~250 lines) + Landing |
| Deploy | 30m | Contract deploy + Vercel |
| CI/CD | 15m | GitHub Actions workflow |
| Screenshots | 30m | Mobile, CI, tests |
| Demo video | 30m | 1:30 recording |

**Total: ~7h** (vs Split Bill's 2 weeks)

---

## 10. Technical Decisions

### Why fee is hardcoded at 2%

Creator-set fees open a rug-pull vector: set 99% fee → drain all losing pool. Hardcoding 2% eliminates this attack surface entirely. The fee goes to the creator as incentive. Simpler contract, less input validation, no frontend field needed.

### Why 1 contract instead of factory+vault

Split Bill needed per-bill vaults because each bill has different participants, shares, and contributions. Prediction market has a `Vec<Market>` in a single contract — all markets share the same storage structure. No dynamic deployment needed.

### Why Freighter-only instead of multi-wallet for TX

Albedo/xBull/Rabet for **read-only** wallet display (address, balance). But TX signing ONLY via Freighter. This avoids the `simSignSendFreighter` vs `simSignSend` dual-flow bug.

### Why SAC instead of raw XLM

The Stellar Asset Contract (SAC) for native XLM provides `token::Client::transfer()` which is the standard way to move XLM in Soroban. Events are emitted automatically.

### Why wasm-opt -Os

- `-O3` optimized too aggressively, corrupted storage writes
- `-O0` (no optimization) kept reference-types, failed to upload
- `-Os` (optimize for size) is the sweet spot — strips reference-types without breaking logic
- **Verified working** in Split Bill's last attempt (factory uploaded successfully)

---

## Appendix: Split Bill Post-Mortem

**What worked:**
- 11 passing contract tests
- Factory-centric architecture (participants in BillInfo)
- CI/CD pipeline
- wasm-opt -Os for reference-types

**What failed:**
- `createCustomContract` per vault → complex TX flow
- `simSignSend` + `simSignUser` dual auth → fragile
- 3 sequential TXs (deploy → init → register) → any one fails = broken
- sorobanData footprint mismatch from simulation

**Lesson learned:** 1 contract, 1 deploy, 1 TX per action. Always.
