const useCases = [
  {
    label: "Expansion Teams",
    title: "Find your next location with confidence",
    desc: "Every region is scored from Cold to Hot using a 5-tier system — factoring in competition, population, and growth trends. Identify areas with high demand but low competition, and make data-driven decisions about where to expand next.",
    visual: (
      <svg width="300" height="180" viewBox="0 0 300 180">
        <rect x="10" y="20" width="55" height="140" rx="4" fill="#1e3a8a" opacity="0.4" /><rect x="10" y="80" width="55" height="80" rx="4" fill="#3b82f6" />
        <rect x="75" y="20" width="55" height="140" rx="4" fill="#1e3a8a" opacity="0.4" /><rect x="75" y="50" width="55" height="110" rx="4" fill="#3b82f6" />
        <rect x="140" y="20" width="55" height="140" rx="4" fill="#1e3a8a" opacity="0.4" /><rect x="140" y="110" width="55" height="50" rx="4" fill="#22c55e" />
        <rect x="205" y="20" width="55" height="140" rx="4" fill="#1e3a8a" opacity="0.4" /><rect x="205" y="130" width="55" height="30" rx="4" fill="#22c55e" />
        <text x="37" y="175" fill="#6b7280" fontSize="10" textAnchor="middle" fontFamily="sans-serif">London</text>
        <text x="102" y="175" fill="#6b7280" fontSize="10" textAnchor="middle" fontFamily="sans-serif">SE</text>
        <text x="167" y="175" fill="#22c55e" fontSize="10" textAnchor="middle" fontFamily="sans-serif">NE ★</text>
        <text x="232" y="175" fill="#22c55e" fontSize="10" textAnchor="middle" fontFamily="sans-serif">NI ★</text>
        <text x="150" y="12" fill="#8b8fa3" fontSize="11" textAnchor="middle" fontFamily="sans-serif">Competitor density vs. your brand</text>
      </svg>
    ),
  },
  {
    label: "Strategy & Analytics",
    title: "Get a competitive brief in seconds, not weeks",
    desc: "Instead of commissioning custom research, pull a competitive brief on any region in seconds. Market share breakdowns, dominance shifts, and growth trajectories — presented as analysis, not raw numbers.",
    visual: (
      <svg width="300" height="180" viewBox="0 0 300 180">
        <circle cx="150" cy="90" r="70" fill="none" stroke="#2a2d3a" strokeWidth="20" />
        <circle cx="150" cy="90" r="70" fill="none" stroke="#22c55e" strokeWidth="20" strokeDasharray="110 330" strokeDashoffset="0" />
        <circle cx="150" cy="90" r="70" fill="none" stroke="#facc15" strokeWidth="20" strokeDasharray="95 345" strokeDashoffset="-110" />
        <circle cx="150" cy="90" r="70" fill="none" stroke="#3b82f6" strokeWidth="20" strokeDasharray="80 360" strokeDashoffset="-205" />
        <circle cx="150" cy="90" r="70" fill="none" stroke="#ef4444" strokeWidth="20" strokeDasharray="70 370" strokeDashoffset="-285" />
        <text x="150" y="85" fill="#fff" fontSize="22" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">914</text>
        <text x="150" y="102" fill="#6b7280" fontSize="11" textAnchor="middle" fontFamily="sans-serif">London Total</text>
      </svg>
    ),
  },
  {
    label: "Regional Managers",
    title: "Track your region's competitive dynamics",
    desc: "Scrub through 10 years of footprint history for your region. Watch how brand positions shifted — which chains expanded aggressively, which lost ground, and where the gaps opened. The patterns are already in the data; now you can see them.",
    visual: (
      <svg width="300" height="180" viewBox="0 0 300 180">
        <text x="20" y="30" fill="#8b8fa3" fontSize="11" fontFamily="sans-serif">North West — Brand Share</text>
        {[
          { y: 45, w: 86, color: '#22c55e', label: 'Subway 36%' },
          { y: 70, w: 56, color: '#facc15', label: "McDonald's 23%" },
          { y: 95, w: 40, color: '#3b82f6', label: "Domino's 17%" },
          { y: 120, w: 36, color: '#ef4444', label: 'KFC 15%' },
          { y: 145, w: 15, color: '#f97316', label: "Nando's 6%" },
        ].map((b) => (
          <g key={b.y}>
            <rect x="20" y={b.y} width="240" height="16" rx="3" fill="#1e2030" />
            <rect x="20" y={b.y} width={b.w} height="16" rx="3" fill={b.color} />
            <text x={20 + b.w + 4} y={b.y + 12} fill="#c0c4d6" fontSize="10" fontFamily="sans-serif">{b.label}</text>
          </g>
        ))}
      </svg>
    ),
  },
]

const UseCases = () => (
  <section className="max-w-[1100px] mx-auto py-24 px-6">
    <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-16">Built for how you actually work</h2>
    {useCases.map((uc, i) => (
      <div
        key={uc.label}
        className={`flex flex-col md:flex-row gap-12 items-center mb-16 ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
      >
        <div className="flex-1">
          <div className="text-xs uppercase tracking-widest text-blue-400 font-semibold mb-2">{uc.label}</div>
          <h3 className="text-2xl sm:text-[28px] font-bold text-foreground mb-3">{uc.title}</h3>
          <p className="text-base text-muted-foreground leading-relaxed">{uc.desc}</p>
        </div>
        <div className="flex-1 bg-surface-0 border border-border rounded-xl p-8 min-h-[240px] flex items-center justify-center">
          {uc.visual}
        </div>
      </div>
    ))}
  </section>
)

export default UseCases
