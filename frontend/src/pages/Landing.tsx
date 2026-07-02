import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-emerald-950 to-blue-950">
      <style>{`
.pl { width: 6em; height: 6em; }
.card-container {
  width: 100%;
  background: linear-gradient(to top right, #975af4, #2f7cf8 40%, #78aafa 65%, #934cff 100%);
  padding: 4px;
  border-radius: 32px;
  display: flex;
  flex-direction: column;
}
.card-container .title-card {
  display: flex;
  align-items: center;
  padding: 16px 18px;
  justify-content: space-between;
  color: #fff;
}
.card-container .title-card p {
  font-size: 14px;
  font-weight: 600;
  font-style: italic;
  text-shadow: 2px 2px 6px #2975ee;
}
.card-container .card-content {
  width: 100%;
  height: 100%;
  background-color: #161a20;
  border-radius: 30px;
  color: #838383;
  font-size: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.card-container .card-content .title {
  font-weight: 600;
  color: #bab9b9;
}
.card-container .card-content .plain :nth-child(1) {
  font-size: 36px;
  color: #fff;
}
.card-container .card-content .card-btn {
  background: linear-gradient(4deg, #975af4, #2f7cf8 40%, #78aafa 65%, #934cff 100%);
  padding: 8px;
  border: none;
  width: 100%;
  border-radius: 8px;
  color: white;
  font-size: 12px;
  transition: all 0.3s ease-in-out;
  cursor: pointer;
  box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.6);
}
.card-container .card-content .card-btn:hover {
  color: #ffffff;
  text-shadow: 0 0 8px #fff;
  transform: scale(1.03);
}
.card-container .card-content .card-btn:active {
  transform: scale(1);
}
.pl__ring { animation: ringA 2s linear infinite; }
.pl__ring--a { stroke: #f42f25; }
.pl__ring--b { animation-name: ringB; stroke: #f49725; }
.pl__ring--c { animation-name: ringC; stroke: #255ff4; }
.pl__ring--d { animation-name: ringD; stroke: #f42582; }
@keyframes ringA {
  from, 4% { stroke-dasharray: 0 660; stroke-width: 20; stroke-dashoffset: -330; }
  12% { stroke-dasharray: 60 600; stroke-width: 30; stroke-dashoffset: -335; }
  32% { stroke-dasharray: 60 600; stroke-width: 30; stroke-dashoffset: -595; }
  40%, 54% { stroke-dasharray: 0 660; stroke-width: 20; stroke-dashoffset: -660; }
  62% { stroke-dasharray: 60 600; stroke-width: 30; stroke-dashoffset: -665; }
  82% { stroke-dasharray: 60 600; stroke-width: 30; stroke-dashoffset: -925; }
  90%, to { stroke-dasharray: 0 660; stroke-width: 20; stroke-dashoffset: -990; }
}
@keyframes ringB {
  from, 12% { stroke-dasharray: 0 220; stroke-width: 20; stroke-dashoffset: -110; }
  20% { stroke-dasharray: 20 200; stroke-width: 30; stroke-dashoffset: -115; }
  40% { stroke-dasharray: 20 200; stroke-width: 30; stroke-dashoffset: -195; }
  48%, 62% { stroke-dasharray: 0 220; stroke-width: 20; stroke-dashoffset: -220; }
  70% { stroke-dasharray: 20 200; stroke-width: 30; stroke-dashoffset: -225; }
  90% { stroke-dasharray: 20 200; stroke-width: 30; stroke-dashoffset: -305; }
  98%, to { stroke-dasharray: 0 220; stroke-width: 20; stroke-dashoffset: -330; }
}
@keyframes ringC {
  from { stroke-dasharray: 0 440; stroke-width: 20; stroke-dashoffset: 0; }
  8% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -5; }
  28% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -175; }
  36%, 58% { stroke-dasharray: 0 440; stroke-width: 20; stroke-dashoffset: -220; }
  66% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -225; }
  86% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -395; }
  94%, to { stroke-dasharray: 0 440; stroke-width: 20; stroke-dashoffset: -440; }
}
@keyframes ringD {
  from, 8% { stroke-dasharray: 0 440; stroke-width: 20; stroke-dashoffset: 0; }
  16% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -5; }
  36% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -175; }
  44%, 50% { stroke-dasharray: 0 440; stroke-width: 20; stroke-dashoffset: -220; }
  58% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -225; }
  78% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -395; }
  86%, to { stroke-dasharray: 0 440; stroke-width: 20; stroke-dashoffset: -440; }
}
      `}</style>

      {/* Hero background animated rings */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-[0.12]">
        <svg className="pl" viewBox="0 0 200 200" width="200" height="200">
          <circle className="pl__ring pl__ring--a" cx="100" cy="100" r="82" />
          <circle className="pl__ring pl__ring--b" cx="100" cy="100" r="82" />
          <circle className="pl__ring pl__ring--c" cx="100" cy="100" r="82" />
          <circle className="pl__ring pl__ring--d" cx="100" cy="100" r="82" />
        </svg>
      </div>

      <nav className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-yellow-500/20 bg-gradient-to-r from-gray-900/95 via-emerald-900/95 to-blue-900/95 backdrop-blur-md">
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

      <section className="relative flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-24 sm:pt-32 pb-16 sm:pb-20 z-10">
        <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1.5 text-sm text-yellow-300 mb-6 sm:mb-8">
          <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          Stellar Orange Belt · FIFA World Cup 2026
        </div>
        <div className="flex items-center justify-center gap-2 text-lg sm:text-xl mb-4">
          <span>🇺🇸</span><span className="text-blue-400">·</span><span>🇨🇦</span><span className="text-red-400">·</span><span>🇲🇽</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-tight max-w-4xl drop-shadow-[0_0_20px_rgba(234,179,8,0.3)]">
          Predict the
          <span className="bg-gradient-to-r from-emerald-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent"> World Cup.</span>
          <br />
          <span className="text-gray-100">Win on-chain.</span>
        </h1>
        <p className="text-yellow-400/60 text-sm sm:text-base md:text-lg max-w-xl mt-4 sm:mt-6 font-medium">
          A decentralized prediction market on Stellar Soroban. Create match markets,
          bet XLM on YES or NO outcomes, and claim your winnings — all trustlessly on-chain.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 w-full sm:w-auto px-4 sm:px-0">
          <button onClick={() => navigate("/app")} className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 via-yellow-500 to-orange-500 hover:from-emerald-400 hover:via-yellow-400 hover:to-orange-400 text-black font-bold px-8 py-3 rounded-xl text-base transition-all shadow-lg shadow-yellow-500/25">
            Launch App ⚽
          </button>
          <a href="#how" className="w-full sm:w-auto text-center border border-yellow-500/30 hover:border-yellow-400 px-8 py-3 rounded-xl text-base font-medium transition-colors text-gray-300 hover:text-white">
            How It Works
          </a>
        </div>
      </section>

      <section id="how" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">How It Works</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {[
            { step: "01", icon: "🎯", title: "Create", desc: "Anyone creates a YES/NO market with a match question and deadline. 2% protocol fee." },
            { step: "02", icon: "⚡", title: "Bet", desc: "Participants bet XLM on YES or NO. All bets are held in the smart contract escrow." },
            { step: "03", icon: "✅", title: "Resolve", desc: "After deadline, creator resolves the market based on real-world match results." },
            { step: "04", icon: "🏆", title: "Claim", desc: "Winners claim their share of the losing pool. Losers walk away. Trustless." },
          ].map((s) => (
            <div key={s.step} className="card-container">
              <div className="title-card">
                <p>Step {s.step}</p>
                <span className="text-xl">{s.icon}</span>
              </div>
              <div className="card-content">
                <div className="title">{s.title}</div>
                <div className="plain">
                  <div>{s.desc}</div>
                </div>
                <button onClick={() => navigate("/app")} className="card-btn">Get Started →</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Why Stellar Prophecy</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
          {[
            { icon: "📜", title: "1 Contract", desc: "No factory, no vaults, no complex deployments. One smart contract handles everything." },
            { icon: "🔒", title: "Trustless", desc: "All bets are escrowed on-chain. Creator can't steal. Winners automatically receive their share." },
            { icon: "⚖️", title: "2% Fee", desc: "Protocol fee is hardcoded at 2%. Creator receives it as incentive. No rug-pull possible." },
          ].map((f) => (
            <div key={f.title} className="card-container">
              <div className="title-card">
                <p>{f.title}</p>
                <span className="text-xl">{f.icon}</span>
              </div>
              <div className="card-content">
                <div className="plain">
                  <div>{f.desc}</div>
                </div>
                <button onClick={() => navigate("/app")} className="card-btn">Launch dApp →</button>
              </div>
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
