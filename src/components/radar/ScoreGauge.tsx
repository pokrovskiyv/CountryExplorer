import { getTierColor } from "@/lib/opportunity-colors";
import type { ScoreTier } from "@/lib/expansion-scoring";

interface ScoreGaugeProps {
  readonly score: number;
  readonly tier: ScoreTier;
  readonly size?: number;
}

const ScoreGauge = ({ score, tier, size = 120 }: ScoreGaugeProps) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - 16) / 2;
  const strokeWidth = 8;
  const circumference = Math.PI * radius; // semi-circle
  const offset = circumference * (1 - score / 100);
  const color = getTierColor(tier);

  return (
    <div className="relative" style={{ width: size, height: size * 0.65 }}>
      <svg
        width={size}
        height={size * 0.65}
        viewBox={`0 0 ${size} ${size * 0.65}`}
        className="overflow-visible"
      >
        {/* Track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(230,25%,20%)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{
            filter: `drop-shadow(0 0 6px ${color}40)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
        <span
          className="text-2xl font-bold tabular-nums leading-none"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground mt-0.5">/ 100</span>
      </div>
    </div>
  );
};

export default ScoreGauge;
