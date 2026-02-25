const Screenshot = () => (
  <div className="max-w-[1100px] mx-auto -mt-5 px-6">
    <div className="bg-surface-0 border border-border rounded-xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
      {/* Window bar */}
      <div className="h-10 bg-surface-1 border-b border-border flex items-center px-4 gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
      </div>
      {/* Screenshot content */}
      <div className="w-full aspect-video bg-gradient-to-br from-surface-deep via-surface-0 to-surface-1 flex items-center justify-center relative overflow-hidden">
        <svg viewBox="0 0 1100 620" xmlns="http://www.w3.org/2000/svg" className="w-full h-full opacity-50">
          <g transform="translate(350,50) scale(1.2)" fill="#1e3a8a" stroke="#2a2d3a" strokeWidth="1" opacity="0.6">
            <path d="M180,50 L220,30 L260,60 L270,120 L250,180 L280,220 L270,280 L240,320 L200,350 L160,380 L120,370 L100,330 L80,280 L70,220 L90,160 L120,100 L150,70 Z" />
            <path d="M60,250 L40,290 L50,330 L80,350 L100,330 L80,280 Z" fill="#1e4a9a" />
            <path d="M130,20 L180,10 L220,30 L200,60 L160,50 L130,20 Z" fill="#0f2d6e" />
          </g>
          <g>
            {[[520,160,'#22c55e'],[530,180,'#facc15'],[480,200,'#ef4444'],[510,220,'#3b82f6'],[540,250,'#f97316'],[500,270,'#a855f7'],[520,300,'#22c55e'],[550,200,'#ef4444'],[490,320,'#facc15'],[530,340,'#3b82f6']].map(([cx,cy,fill], i) => (
              <circle key={i} cx={cx as number} cy={cy as number} r="4" fill={fill as string} opacity="0.7" />
            ))}
          </g>
          <rect x="30" y="50" width="200" height="520" rx="8" fill="#161822" stroke="#2a2d3a" />
          <text x="50" y="85" fill="#6b7280" fontSize="11" fontFamily="sans-serif">BRANDS</text>
          {[
            [110, '#22c55e', 'Subway (2,063)'],
            [138, '#facc15', "McDonald's (1,508)"],
            [166, '#3b82f6', "Domino's (1,331)"],
            [194, '#ef4444', 'KFC (1,037)'],
            [222, '#f97316', "Nando's (484)"],
            [250, '#a855f7', "Papa John's (397)"],
          ].map(([y, color, label], i) => (
            <g key={i}>
              <circle cx="56" cy={y as number} r="6" fill={color as string} />
              <text x="70" y={(y as number) + 4} fill="#c0c4d6" fontSize="12" fontFamily="sans-serif">{label}</text>
            </g>
          ))}
          <rect x="780" y="50" width="290" height="520" rx="8" fill="#161822" stroke="#2a2d3a" />
          <text x="800" y="85" fill="#fff" fontSize="16" fontWeight="bold" fontFamily="sans-serif">London</text>
          <rect x="800" y="100" width="120" height="60" rx="6" fill="#1e2030" />
          <text x="812" y="118" fill="#6b7280" fontSize="10" fontFamily="sans-serif">TOTAL</text>
          <text x="812" y="145" fill="#fff" fontSize="22" fontWeight="bold" fontFamily="sans-serif">914</text>
          <rect x="935" y="100" width="120" height="60" rx="6" fill="#1e2030" />
          <text x="947" y="118" fill="#6b7280" fontSize="10" fontFamily="sans-serif">PER 100K</text>
          <text x="947" y="145" fill="#fff" fontSize="22" fontWeight="bold" fontFamily="sans-serif">10.3</text>
        </svg>
        <div className="absolute top-[20%] left-[15%] bg-blue-600 text-white px-4 py-2 rounded-md text-[13px] font-semibold">12 Regions</div>
        <div className="absolute top-[40%] right-[20%] bg-blue-600 text-white px-4 py-2 rounded-md text-[13px] font-semibold">6,820 Locations</div>
        <div className="absolute bottom-[25%] left-[30%] bg-blue-600 text-white px-4 py-2 rounded-md text-[13px] font-semibold">Real-time Data</div>
      </div>
    </div>
  </div>
);

export default Screenshot;
