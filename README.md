# Stellar Prophecy — Prediction Market dApp

**Decentralized binary prediction market on Stellar Soroban.**

Create YES/NO markets, bet XLM, resolve based on real-world facts, claim winnings — all on-chain with 13 smart contract tests.

## Live Demo

- **Frontend**: https://frontend-ashy-chi-87.vercel.app
- **Explorer**: https://stellar.expert/explorer/testnet/contract/CANFJTJMC6KHB42CDC5JHI5UBI3E5BH7HYYE3UB5VASCVSA5CAM52NO3

## Deployed (Testnet)

| Item | Address/Hash |
|------|-------------|
| Contract | `CANFJTJMC6KHB42CDC5JHI5UBI3E5BH7HYYE3UB5VASCVSA5CAM52NO3` |
| Native XLM | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| TX (place_bet) | `fcf595c975877f19e512ba51c7b8b51872a2bd141529766baedbc0ec991059bf` |

## Features

- **Create Market** — anyone can create a YES/NO prediction market with a deadline
- **Place Bet** — bet XLM on YES or NO side (accumulative per user)
- **Resolve Market** — creator resolves outcome after deadline
- **Claim Winnings** — winners claim proportional share of losing pool (minus 2% protocol fee)
- **Persistent State** — all markets and bets stored on-chain via Soroban

## Tech Stack

- **Smart Contract**: Rust · Soroban SDK v27
- **Frontend**: React 19 · TypeScript · Vite · Tailwind CSS v4
- **Wallet**: Freighter (via `@stellar/freighter-api`)
- **RPC**: `stellar-sdk@13.3.0` with raw RPC calls (bypasses SDK XDR parsing)
- **CI/CD**: GitHub Actions (contract tests + WASM build + frontend build)
- **Hosting**: [Vercel](https://frontend-ashy-chi-87.vercel.app)

## Architecture

```
User (Freighter) → React dApp → Soroban RPC → Prediction Market Contract
                                             → Native Token Contract (XLM transfers)
```

All XDR parsing (SorobanTransactionData, SorobanAuthorizationEntry, ScVal) is wrapped in try-catch to handle js-xdr v3 incompatibilities with current testnet protocol.

## Prerequisites

- Rust 1.84+ with `wasm32v1-none` target
- Node.js 20+
- Freighter wallet extension

## Quick Start

```bash
# Contracts
cargo test -p prediction-market     # 13 tests
cargo build --release --target wasm32v1-none -p prediction-market
wasm-opt -Os --enable-bulk-memory --enable-sign-ext -o prediction_market.wasm target/wasm32v1-none/release/prediction_market.wasm

# Deploy
stellar contract deploy --wasm prediction_market.wasm --source <key> --network testnet

# Frontend
cd frontend
cp .env.example .env  # or set VITE_CONTRACT_ADDRESS + VITE_NATIVE_TOKEN
npm install
npm run dev
```

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
1. **contract-tests** — runs `cargo test` for all contract tests
2. **contract-build** — builds optimized WASM binary
3. **frontend-build** — installs deps and runs `tsc -b && vite build`

## Screenshots

> *Add screenshots here: mobile responsive view, CI/CD pipeline, `cargo test` output*

## Demo Video

> *Add link to 1-2 minute demo video*

## License

MIT © 2026 — Stellar Orange Belt
