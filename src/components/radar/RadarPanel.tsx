import { BRANDS } from "@/data/uk-data";
import type { RegionScore } from "@/lib/expansion-scoring";
import { getTierColor } from "@/lib/opportunity-colors";
import { generateInsight, formatPopulation } from "@/lib/insight-generator";
import ScoreGauge from "./ScoreGauge";
import ScoreBadge from "./ScoreBadge";
import OpportunityChart from "./OpportunityChart";

interface RadarPanelProps {
  readonly targetBrand: string;
  readonly selectedScore: RegionScore | undefined;
  readonly topOpportunities: readonly RegionScore[];
  readonly onSelectRegion: (region: string) => void;
  readonly onClose: () => void;
}

const SUB_SCORE_META: { key: keyof RegionScore["breakdown"]; label: string; color: string; desc: string }[] = [
  { key: "penetrationGap", label: "Penetration Gap", color: "#ec4899", desc: "Brand density vs national average" },
  { key: "competitorPresence", label: "Competitor Presence", color: "#3b82f6", desc: "Validated demand from rivals" },
  { key: "populationScore", label: "Population Size", color: "#22c55e", desc: "Addressable market size" },
  { key: "densityHeadroom", label: "Density Headroom", color: "#f59e0b", desc: "Room for QSR growth overall" },
];

const RadarPanel = ({
  targetBrand,
  selectedScore,
  topOpportunities,
  onSelectRegion,
  onClose,
}: RadarPanelProps) => {
  if (!selectedScore) {
    return (
      <div className="w-[380px] bg-[hsl(230,25%,10%)] border-l border-border shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="text-base font-semibold">Expansion Radar</h2>
        </div>
        <div className="p-4">
          <p className="text-muted-foreground text-[13px] mb-4">
            Click a region on the map to see its expansion opportunity breakdown.
          </p>
          <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">
            Top opportunities for {targetBrand}
          </h3>
          <div className="space-y-2">
            {topOpportunities.map((opp) => (
              <button
                key={opp.region}
                onClick={() => onSelectRegion(opp.region)}
                className="w-full bg-[hsl(230,25%,13%)] rounded-lg p-3.5 text-left hover:bg-[hsl(230,25%,15%)] transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium text-slate-200">
                    {opp.region.replace(" (England)", "")}
                  </span>
                  <ScoreBadge tier={opp.tier} />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {opp.brandCount} {targetBrand} locations · Score: {opp.composite}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { region, composite, tier, breakdown, brandCount, totalCount, population } = selectedScore;
  const insight = generateInsight(targetBrand, selectedScore);
  const brandColor = BRANDS[targetBrand]?.color || "#3b82f6";

  return (
    <div className="w-[380px] bg-[hsl(230,25%,10%)] border-l border-border shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{region.replace(" (England)", "")}</h2>
          <ScoreBadge tier={tier} />
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-lg px-1"
        >
          ×
        </button>
      </div>

      <div className="p-4">
        {/* Score Gauge */}
        <div className="flex justify-center mb-3">
          <ScoreGauge score={composite} tier={tier} size={140} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[hsl(230,25%,13%)] rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Brand</div>
            <div className="text-lg font-bold tabular-nums" style={{ color: brandColor }}>
              {brandCount}
            </div>
          </div>
          <div className="bg-[hsl(230,25%,13%)] rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total QSR</div>
            <div className="text-lg font-bold text-foreground tabular-nums">{totalCount}</div>
          </div>
          <div className="bg-[hsl(230,25%,13%)] rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Pop.</div>
            <div className="text-lg font-bold text-foreground tabular-nums">
              {formatPopulation(population)}
            </div>
          </div>
        </div>

        {/* Sub-score bars */}
        <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2.5">
          Factor breakdown
        </h4>
        <div className="space-y-2.5 mb-4">
          {SUB_SCORE_META.map(({ key, label, color, desc }) => {
            const value = breakdown[key];
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] text-slate-300">{label}</span>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
                    {value}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[hsl(230,25%,15%)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${value}%`, background: color }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
              </div>
            );
          })}
        </div>

        {/* Radar Chart */}
        <OpportunityChart breakdown={breakdown} tier={tier} />

        {/* Insight */}
        <div className="mt-4 bg-[hsl(230,25%,13%)] rounded-lg p-3.5">
          <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: getTierColor(tier) }} />
            AI Insight
          </h4>
          <p className="text-[12px] text-slate-300 leading-relaxed">{insight}</p>
        </div>
      </div>
    </div>
  );
};

export default RadarPanel;
