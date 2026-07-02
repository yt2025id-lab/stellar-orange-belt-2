import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-emerald-950 to-blue-950">
      <style>{`
.loader {
  --color-one: #ffbf48;
  --color-two: #be4a1d;
  --color-three: #ffbf4780;
  --color-four: #bf4a1d80;
  --color-five: #ffbf4740;
  --time-animation: 2s;
  --size: 1;
  position: relative;
  border-radius: 50%;
  transform: scale(var(--size));
  box-shadow: 0 0 25px 0 var(--color-three), 0 20px 50px 0 var(--color-four);
  animation: colorize calc(var(--time-animation) * 3) ease-in-out infinite;
}
.loader::before {
  content: "";
  position: absolute;
  top: 0; left: 0;
  width: 100px; height: 100px;
  border-radius: 50%;
  border-top: solid 1px var(--color-one);
  border-bottom: solid 1px var(--color-two);
  background: linear-gradient(180deg, var(--color-five), var(--color-four));
  box-shadow: inset 0 10px 10px 0 var(--color-three), inset 0 -10px 10px 0 var(--color-four);
}
.loader .box {
  width: 100px; height: 100px;
  background: linear-gradient(180deg, var(--color-one) 30%, var(--color-two) 70%);
  mask: url(#clipping); -webkit-mask: url(#clipping);
}
.loader svg { position: absolute; }
.loader svg #clipping { filter: contrast(15); animation: roundness calc(var(--time-animation) / 2) linear infinite; }
.loader svg #clipping polygon { filter: blur(7px); }
.loader svg #clipping polygon:nth-child(1) { transform-origin: 75% 25%; transform: rotate(90deg); }
.loader svg #clipping polygon:nth-child(2) { transform-origin: 50% 50%; animation: rotation var(--time-animation) linear infinite reverse; }
.loader svg #clipping polygon:nth-child(3) { transform-origin: 50% 60%; animation: rotation var(--time-animation) linear infinite; animation-delay: calc(var(--time-animation) / -3); }
.loader svg #clipping polygon:nth-child(4) { transform-origin: 40% 40%; animation: rotation var(--time-animation) linear infinite reverse; }
.loader svg #clipping polygon:nth-child(5) { transform-origin: 40% 40%; animation: rotation var(--time-animation) linear infinite reverse; animation-delay: calc(var(--time-animation) / -2); }
.loader svg #clipping polygon:nth-child(6) { transform-origin: 60% 40%; animation: rotation var(--time-animation) linear infinite; }
.loader svg #clipping polygon:nth-child(7) { transform-origin: 60% 40%; animation: rotation var(--time-animation) linear infinite; animation-delay: calc(var(--time-animation) / -1.5); }
@keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes roundness { 0% { filter: contrast(15); } 20% { filter: contrast(3); } 40% { filter: contrast(3); } 60% { filter: contrast(15); } 100% { filter: contrast(15); } }
@keyframes colorize { 0% { filter: hue-rotate(0deg); } 20% { filter: hue-rotate(-30deg); } 40% { filter: hue-rotate(-60deg); } 60% { filter: hue-rotate(-90deg); } 80% { filter: hue-rotate(-45deg); } 100% { filter: hue-rotate(0deg); } }
      `}</style>

      {/* Hero background loader */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-[0.15]">
        <div className="loader" style={{ transform: 'scale(4)' }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <defs>
              <clipPath id="clipping">
                <polygon points="6,50 25,95 75,95 94,50 75,5 25,5" />
                <polygon points="9,50 32,93 68,93 91,50 68,7 32,7" />
                <polygon points="14,50 38,90 62,90 86,50 62,10 38,10" />
                <polygon points="19,50 40,86 60,86 81,50 60,14 40,14" />
                <polygon points="24,50 43,82 57,82 76,50 57,18 43,18" />
                <polygon points="30,50 46,78 54,78 70,50 54,22 46,22" />
                <polygon points="36,50 48,74 52,74 64,50 52,26 48,26" />
              </clipPath>
            </defs>
            <rect width="100" height="100" fill="currentColor" />
          </svg>
          <div className="box" />
        </div>
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
