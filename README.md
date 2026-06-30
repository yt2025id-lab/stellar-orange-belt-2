# Stellar Prophecy — Prediction Market dApp

**Decentralized binary prediction market on Stellar Soroban.**

Create YES/NO markets, bet XLM, resolve based on real-world facts, claim winnings — all on-chain with 15 smart contract tests.

## Deployed (Testnet)

| Item | Address/Hash |
|------|-------------|
| Contract | `CAOIYOFM2UZSMZSHSEA2U2SKLKZSC23QLRBTVX62P6PCFW2KP3LLNOHN` |
| Native XLM | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

## Tech Stack

- Smart Contract: Rust · Soroban SDK v22
- Frontend: React 19 · TypeScript · Vite · Tailwind CSS v4
- Wallet: Freighter
- CI/CD: GitHub Actions
- Hosting: [Vercel](https://frontend-ashy-chi-87.vercel.app)

## Quick Start

```bash
# Contracts
cargo test                        # 15 tests
cargo build --release --target wasm32-unknown-unknown
wasm-opt -Os --enable-bulk-memory --enable-sign-ext -o prophecy.wasm target/wasm32-unknown-unknown/release/prediction_market.wasm

# Frontend
cd frontend
npm install
npm run dev
```

## License

MIT © 2026 — Stellar Orange Belt
