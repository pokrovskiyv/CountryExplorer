import type { ScoreTier } from "./expansion-scoring";

/**
 * 5-step color ramp for opportunity scores: Cold→Cool→Moderate→Warm→Hot
 * Dark slate → Teal → Amber → Red-orange → Hot pink
 */
const COLOR_STOPS: readonly [number, number, number][] = [
  [51, 65, 85],     // slate-500 (Cold)
  [20, 148, 132],   // teal-500 (Cool)
  [245, 158, 11],   // amber-500 (Moderate)
  [239, 68, 68],    // red-500 (Warm)
  [236, 72, 153],   // pink-500 (Hot)
];

/** Interpolates the radar color ramp. t: 0 (Cold) to 1 (Hot) */
export function interpolateRadarColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const idx = clamped * (COLOR_STOPS.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;

  if (i >= COLOR_STOPS.length - 1) {
    return `rgb(${COLOR_STOPS[COLOR_STOPS.length - 1].join(",")})`;
  }

  const rgb = COLOR_STOPS[i].map((v, j) => Math.round(v + f * (COLOR_STOPS[i + 1][j] - v)));
  return `rgb(${rgb.join(",")})`;
}

/** Returns the tier's representative color as hex */
export function getTierColor(tier: ScoreTier): string {
  switch (tier) {
    case "Hot": return "#ec4899";
    case "Warm": return "#ef4444";
    case "Moderate": return "#f59e0b";
    case "Cool": return "#14b8a6";
    case "Cold": return "#64748b";
  }
}

/** Returns a subtle background color for tier badges */
export function getTierBgColor(tier: ScoreTier): string {
  switch (tier) {
    case "Hot": return "rgba(236,72,153,0.15)";
    case "Warm": return "rgba(239,68,68,0.15)";
    case "Moderate": return "rgba(245,158,11,0.15)";
    case "Cool": return "rgba(20,148,132,0.15)";
    case "Cold": return "rgba(100,116,139,0.15)";
  }
}
