import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <nav className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-emerald-900/40 bg-gray-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-yellow-500 rounded-full flex items-center justify-center font-bold text-sm shadow-lg shadow-emerald-600/20">⚽</div>
          <span className="hidden sm:inline">
            <span className="font-bold text-emerald-400">World Cup</span>
            <span className="text-gray-400 ml-1">Prophecy</span>
          </span>
          <span className="sm:hidden font-bold text-emerald-400">WC Prophecy</span>
        </div>
        <button onClick={() => navigate("/app")} className="bg-gradient-to-r from-emerald-600 to-yellow-600 hover:from-emerald-500 hover:to-yellow-500 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-600/20">
          Launch dApp 🚀
        </button>
      </nav>

      <section className="flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-24 sm:pt-32 pb-16 sm:pb-20">
        <div className="inline-flex items-center gap-2 bg-emerald-600/10 border border-emerald-600/30 rounded-full px-4 py-1.5 text-sm text-emerald-300 mb-6 sm:mb-8">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Stellar Orange Belt · FIFA World Cup 2026
        </div>
        <div className="text-5xl sm:text-6xl md:text-7xl mb-6">🏆</div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold leading-tight max-w-4xl">
          Predict the
          <span className="bg-gradient-to-r from-emerald-400 via-yellow-400 to-emerald-400 bg-clip-text text-transparent"> World Cup.</span>
          <br />
          <span className="text-gray-300">Win on-chain.</span>
        </h1>
        <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-xl mt-4 sm:mt-6">
          A decentralized prediction market on Stellar Soroban. Create match markets,
          bet XLM on YES or NO outcomes, and claim your winnings — all trustlessly on-chain.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 w-full sm:w-auto px-4 sm:px-0">
          <button onClick={() => navigate("/app")} className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-yellow-600 hover:from-emerald-500 hover:to-yellow-500 px-8 py-3 rounded-xl text-base font-semibold transition-all shadow-lg shadow-emerald-600/25">
            Launch App ⚽
          </button>
          <a href="#how" className="w-full sm:w-auto text-center border border-gray-700 hover:border-emerald-500 px-8 py-3 rounded-xl text-base font-medium transition-colors">
            How It Works
          </a>
        </div>
      </section>

      <section id="how" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">How It Works</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {[
            { step: "1", title: "Create", desc: "Anyone creates a YES/NO market with a match question and deadline. 2% protocol fee." },
            { step: "2", title: "Bet", desc: "Participants bet XLM on YES or NO. All bets are held in the smart contract escrow." },
            { step: "3", title: "Resolve", desc: "After deadline, creator resolves the market based on real-world match results." },
            { step: "4", title: "Claim", desc: "Winners claim their share of the losing pool. Losers walk away. Trustless." },
          ].map((s) => (
            <div key={s.step} className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 sm:p-6 text-center backdrop-blur-sm">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-sm">{s.step}</div>
              <h3 className="font-semibold mb-2 text-emerald-400">{s.title}</h3>
              <p className="text-gray-400 text-xs sm:text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {[
            { title: "1 Contract", desc: "No factory, no vaults, no complex deployments. One smart contract handles everything." },
            { title: "Trustless", desc: "All bets are escrowed on-chain. Creator can't steal. Winners automatically receive their share." },
            { title: "2% Fee", desc: "Protocol fee is hardcoded at 2%. Creator receives it as incentive. No rug-pull possible." },
          ].map((f) => (
            <div key={f.title} className="border border-gray-800 rounded-xl p-5 sm:p-6">
              <h3 className="font-semibold text-emerald-400 mb-2">{f.title}</h3>
              <p className="text-gray-400 text-xs sm:text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-emerald-900/40 py-8 text-center text-gray-500 text-xs sm:text-sm">
        World Cup Prophecy · Orange Belt · Stellar Soroban · 2026
      </footer>
    </div>
  );
}
