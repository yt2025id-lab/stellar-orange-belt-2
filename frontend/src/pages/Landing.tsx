import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center font-bold text-sm">P</div>
          <span className="font-semibold text-lg">Stellar Prophecy</span>
        </div>
        <button onClick={() => navigate("/app")} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Launch dApp →
        </button>
      </nav>

      <section className="flex flex-col items-center justify-center text-center px-6 pt-32 pb-20">
        <div className="inline-flex items-center gap-2 bg-purple-600/20 border border-purple-600/30 rounded-full px-4 py-1.5 text-sm text-purple-300 mb-8">
          <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
          Stellar Orange Belt
        </div>
        <h1 className="text-5xl md:text-7xl font-bold leading-tight max-w-3xl">
          Bet on the
          <span className="text-purple-400"> future.</span>
          <br />
          Settled on-chain.
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mt-6">
          A decentralized binary prediction market on Stellar Soroban. Create markets,
          bet XLM on YES or NO, and claim your winnings — all trustlessly on-chain.
        </p>
        <div className="flex gap-4 mt-8">
          <button onClick={() => navigate("/app")} className="bg-purple-600 hover:bg-purple-700 px-8 py-3 rounded-xl text-base font-semibold transition-all hover:shadow-lg hover:shadow-purple-600/25">
            Launch App →
          </button>
          <a href="#how" className="border border-gray-700 hover:border-gray-500 px-8 py-3 rounded-xl text-base font-medium transition-colors">
            How It Works
          </a>
        </div>
      </section>

      <section id="how" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: "1", title: "Create", desc: "Anyone creates a YES/NO market with a question and deadline. Fee is fixed at 2%." },
            { step: "2", title: "Bet", desc: "Participants bet XLM on YES or NO. All bets are held in the smart contract escrow." },
            { step: "3", title: "Resolve", desc: "After deadline, creator resolves the market based on real-world facts." },
            { step: "4", title: "Claim", desc: "Winners claim their share of the losing pool. Losers walk away. Trustless." },
          ].map((s) => (
            <div key={s.step} className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold">{s.step}</div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-gray-400 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: "1 Contract", desc: "No factory, no vaults, no complex deployments. One smart contract handles everything." },
            { title: "Trustless", desc: "All bets are escrowed on-chain. Creator can't steal. Winners automatically receive their share." },
            { title: "2% Fee", desc: "Protocol fee is hardcoded at 2%. Creator receives it as incentive. No rug-pull possible." },
          ].map((f) => (
            <div key={f.title} className="border border-gray-800 rounded-xl p-6">
              <h3 className="font-semibold text-purple-400 mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-800 py-8 text-center text-gray-500 text-sm">
        Stellar Prophecy · Orange Belt · Journey to Mastery · 2026
      </footer>
    </div>
  );
}
