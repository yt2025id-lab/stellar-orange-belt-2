import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-950 to-blue-950">
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
.why-card {
  --white: hsl(0, 0%, 100%);
  --black: hsl(240, 15%, 9%);
  --paragraph: hsl(0, 0%, 83%);
  --line: hsl(240, 9%, 17%);
  --primary: hsl(271, 91%, 65%);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  width: 100%;
  background-color: hsla(240, 15%, 9%, 1);
  background-image:
    radial-gradient(at 88% 40%, hsla(240, 15%, 9%, 1) 0px, transparent 85%),
    radial-gradient(at 49% 30%, hsla(240, 15%, 9%, 1) 0px, transparent 85%),
    radial-gradient(at 14% 26%, hsla(240, 15%, 9%, 1) 0px, transparent 85%),
    radial-gradient(at 0% 64%, hsl(271, 99%, 26%) 0px, transparent 85%),
    radial-gradient(at 41% 94%, hsl(271, 97%, 36%) 0px, transparent 85%),
    radial-gradient(at 100% 99%, hsl(270, 94%, 13%) 0px, transparent 85%);
  border-radius: 1rem;
  box-shadow: 0px -16px 24px 0px rgba(147, 76, 255, 0.25) inset;
}
.why-card .card__border {
  overflow: hidden;
  pointer-events: none;
  position: absolute;
  z-index: -10;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: calc(100% + 2px);
  height: calc(100% + 2px);
  background-image: linear-gradient(0deg, hsl(0, 0%, 100%) -50%, hsl(0, 0%, 40%) 100%);
  border-radius: 1rem;
}
.why-card .card__border::before {
  content: "";
  pointer-events: none;
  position: fixed;
  z-index: 200;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(0deg);
  transform-origin: left;
  width: 200%;
  height: 10rem;
  background-image: linear-gradient(0deg, hsla(0, 0%, 100%, 0) 0%, hsl(271, 100%, 50%) 40%, hsl(271, 100%, 50%) 60%, hsla(0, 0%, 40%, 0) 100%);
  animation: rotate 8s linear infinite;
}
@keyframes rotate {
  to { transform: rotate(360deg); }
}
.why-card .card_title__container .card_title {
  font-size: 1rem;
  color: var(--white);
}
.why-card .card_title__container .card_paragraph {
  margin-top: 0.25rem;
  width: 100%;
  font-size: 0.7rem;
  color: var(--paragraph);
  line-height: 1.4;
}
.why-card .line {
  width: 100%;
  height: 0.1rem;
  background-color: var(--line);
  border: none;
}
.why-card .button {
  cursor: pointer;
  padding: 0.5rem;
  width: 100%;
  background-image: linear-gradient(0deg, hsl(271, 91%, 65%), hsl(271, 70%, 40%) 100%);
  font-size: 0.7rem;
  color: var(--white);
  border: 0;
  border-radius: 9999px;
  box-shadow: inset 0 -2px 25px -4px var(--white);
  transition: all 0.3s ease;
}
.why-card .button:hover {
  transform: scale(1.03);
  box-shadow: inset 0 -2px 25px -4px var(--white), 0 0 20px rgba(147, 76, 255, 0.4);
}
.why-card .button:active {
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

      <nav className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-purple-500/20 bg-gradient-to-r from-gray-900/95 via-purple-950/95 to-blue-950/95 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center font-bold text-sm shadow-lg shadow-purple-600/20">⚽</div>
          <span className="hidden sm:inline">
            <span className="font-bold text-purple-400">World Cup</span>
            <span className="text-gray-400 ml-1">Prophecy</span>
          </span>
          <span className="sm:hidden font-bold text-purple-400">WC Prophecy</span>
        </div>
        <button onClick={() => navigate("/app")} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-purple-600/20">
          Launch dApp 🚀
        </button>
      </nav>

      <section className="relative flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-24 sm:pt-32 pb-16 sm:pb-20 z-10">
        <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-full px-4 py-1.5 text-sm text-purple-300 mb-6 sm:mb-8">
          <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
          Stellar Orange Belt · FIFA World Cup 2026
        </div>
        <div className="flex items-center justify-center gap-2 text-lg sm:text-xl mb-4">
          <span>🇺🇸</span><span className="text-blue-400">·</span><span>🇨🇦</span><span className="text-red-400">·</span><span>🇲🇽</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-tight max-w-4xl drop-shadow-[0_0_20px_rgba(147,76,255,0.3)]">
          Predict the
          <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent"> World Cup.</span>
          <br />
          <span className="text-gray-100">Win on-chain.</span>
        </h1>
        <p className="text-purple-300/60 text-sm sm:text-base md:text-lg max-w-xl mt-4 sm:mt-6 font-medium">
          A decentralized prediction market on Stellar Soroban. Create match markets,
          bet XLM on YES or NO outcomes, and claim your winnings — all trustlessly on-chain.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 w-full sm:w-auto px-4 sm:px-0">
          <button onClick={() => navigate("/app")} className="w-full sm:w-auto bg-gradient-to-r from-purple-500 via-blue-500 to-purple-600 hover:from-purple-400 hover:via-blue-400 hover:to-purple-500 text-white font-bold px-8 py-3 rounded-xl text-base transition-all shadow-lg shadow-purple-500/25">
            Launch App ⚽
          </button>
          <a href="#how" className="w-full sm:w-auto text-center border border-purple-500/30 hover:border-purple-400 px-8 py-3 rounded-xl text-base font-medium transition-colors text-gray-300 hover:text-white">
            How It Works
          </a>
        </div>
      </section>

      <section id="how" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
          <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">How It Works</span>
        </h2>
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
                  <div>{s.step}</div>
                </div>
                <div className="text-gray-400 leading-relaxed">{s.desc}</div>
                <button onClick={() => navigate("/app")} className="card-btn">Get Started →</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
          <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Why Stellar Prophecy</span>
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
          {[
            { title: "1 Contract", desc: "No factory, no vaults, no complex deployments. One smart contract handles everything.", icon: "📜" },
            { title: "Trustless", desc: "All bets are escrowed on-chain. Creator can't steal. Winners automatically receive their share.", icon: "🔒" },
            { title: "2% Fee", desc: "Protocol fee is hardcoded at 2%. Creator receives it as incentive. No rug-pull possible.", icon: "⚖️" },
          ].map((f) => (
            <div key={f.title} className="why-card">
              <div className="card__border" />
              <div className="card_title__container">
                <div className="card_title">{f.icon} {f.title}</div>
                <div className="card_paragraph">{f.desc}</div>
              </div>
              <hr className="line" />
              <button onClick={() => navigate("/app")} className="button">Launch dApp →</button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-purple-900/40 py-8 text-center text-gray-500 text-xs sm:text-sm">
        World Cup Prophecy · Orange Belt · Stellar Soroban · 2026
      </footer>
    </div>
  );
}
