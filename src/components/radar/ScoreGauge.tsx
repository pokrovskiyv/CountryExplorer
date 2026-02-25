import { getTierColor } from "@/lib/opportunity-colors";
import type { ScoreTier } from "@/lib/expansion-scoring";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

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
      <style>{`
        @keyframes gauge-glow-pulse {
          0% { filter: drop-shadow(0 0 6px ${color}40); }
          50% { filter: drop-shadow(0 0 12px ${color}70); }
          100% { filter: drop-shadow(0 0 6px ${color}40); }
        }
      `}</style>
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
          stroke="hsl(var(--surface-3))"
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
            animation: "gauge-glow-pulse 1.2s ease-in-out 1",
            filter: `drop-shadow(0 0 6px ${color}40)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="text-2xl font-bold tabular-nums leading-none cursor-help"
              style={{ color }}
            >
              {score}
            </span>
          </TooltipTrigger>
          <TooltipContent className="bg-surface-0 border-border text-foreground text-xs max-w-[220px] leading-relaxed">
            Weighted composite score (0–100) combining all factors below. Higher = stronger expansion opportunity.
          </TooltipContent>
        </Tooltip>
        <span className="text-[10px] text-muted-foreground mt-0.5">/ 100</span>
      </div>
    </div>
  );
};

export default ScoreGauge;
