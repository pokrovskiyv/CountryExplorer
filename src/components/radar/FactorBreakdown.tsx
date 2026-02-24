import type { ScoreBreakdown, OpportunityWeights } from "@/lib/expansion-scoring";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface FactorBreakdownProps {
  readonly breakdown: ScoreBreakdown;
  readonly weights: OpportunityWeights;
}

interface FactorMeta {
  readonly key: keyof ScoreBreakdown;
  readonly label: string;
  readonly tooltip: string;
  readonly color: string;
  readonly desc: string;
  readonly zeroDesc: string;
}

const FACTOR_META: readonly FactorMeta[] = [
  {
    key: "penetrationGap",
    label: "Penetration Gap",
    tooltip:
      "Measures how far the brand\u2019s density is below the national average. Higher score = more room to grow. Zero means the brand is already at or above the national average.",
    color: "#ec4899",
    desc: "Brand density vs national average",
    zeroDesc: "Already at or above national average density",
  },
  {
    key: "competitorPresence",
    label: "Competitor Presence",
    tooltip:
      "Measures how many competitor QSR outlets are in the region. High competitor density signals proven demand for fast food, validating expansion potential.",
    color: "#3b82f6",
    desc: "Validated demand from rivals",
    zeroDesc: "Low competitor activity in this region",
  },
  {
    key: "populationScore",
    label: "Population Size",
    tooltip:
      "Normalized population score. Larger populations mean a bigger addressable market and more potential customers.",
    color: "#22c55e",
    desc: "Addressable market size",
    zeroDesc: "Smallest addressable market",
  },
  {
    key: "densityHeadroom",
    label: "Density Headroom",
    tooltip:
      "Measures how much room the overall QSR market has to grow. Higher score means lower saturation \u2014 fewer restaurants per capita compared to the densest region.",
    color: "#f59e0b",
    desc: "Room for QSR growth overall",
    zeroDesc: "Highest QSR saturation nationally",
  },
];

const FactorBreakdown = ({ breakdown, weights }: FactorBreakdownProps) => {
  const totalWeight =
    weights.penetrationGap +
    weights.competitorPresence +
    weights.populationScore +
    weights.densityHeadroom;

  return (
    <div className="space-y-3">
      {FACTOR_META.map(({ key, label, tooltip, color, desc, zeroDesc }) => {
        const value = breakdown[key];
        const weightPct =
          totalWeight > 0 ? Math.round((weights[key] / totalWeight) * 100) : 0;
        const isZero = value === 0;
        const barWidth = isZero ? 2 : value;

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[11px] text-slate-300 cursor-help border-b border-dashed border-muted-foreground/40">
                      {label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-[hsl(230,25%,11%)] border-border text-slate-200 text-xs max-w-[220px] leading-relaxed">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
                <span className="text-[10px] text-muted-foreground">
                  ({weightPct}%)
                </span>
              </div>
              <span
                className="text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded"
                style={{
                  color,
                  background: `${color}18`,
                }}
              >
                {value}
              </span>
            </div>
            <div className="w-full h-2.5 bg-[hsl(230,25%,15%)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${barWidth}%`,
                  background: isZero
                    ? "hsl(230,15%,30%)"
                    : `linear-gradient(to right, ${color}90, ${color})`,
                }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {isZero ? zeroDesc : desc}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FactorBreakdown;
