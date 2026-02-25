import type { RegionScore, OpportunityWeights } from "@/lib/expansion-scoring";
import ScoreGauge from "./ScoreGauge";
import ScoreBadge from "./ScoreBadge";
import StatTiles from "./StatTiles";
import FactorBreakdown from "./FactorBreakdown";
import ComparativeSnapshot from "./ComparativeSnapshot";
import InsightCard from "./InsightCard";

interface RadarPanelProps {
  readonly targetBrand: string;
  readonly selectedScore: RegionScore | undefined;
  readonly topOpportunities: readonly RegionScore[];
  readonly onSelectRegion: (region: string) => void;
  readonly onClose: () => void;
  readonly weights: OpportunityWeights;
  readonly allScores: readonly RegionScore[];
}

const SectionHeader = ({ title }: { readonly title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
      {title}
    </h4>
    <div className="flex-1 h-px bg-border" />
  </div>
);

const RadarPanel = ({
  targetBrand,
  selectedScore,
  topOpportunities,
  onSelectRegion,
  onClose,
  weights,
  allScores,
}: RadarPanelProps) => {
  if (!selectedScore) {
    return (
      <div className="w-[380px] bg-surface-0 border-l border-border shrink-0 overflow-y-auto">
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
                className="w-full bg-surface-1 rounded-lg p-3.5 text-left hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium text-foreground">
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

  const { region, composite, tier, breakdown } = selectedScore;

  return (
    <div className="w-[380px] bg-surface-0 border-l border-border shrink-0 overflow-y-auto">
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

      <div className="p-4 space-y-0">
        {/* 1. Score Gauge (hero) */}
        <div
          className="flex justify-center mb-3 animate-in fade-in-0 slide-in-from-bottom-2"
          style={{ animationDuration: "400ms" }}
        >
          <ScoreGauge score={composite} tier={tier} size={140} />
        </div>

        {/* 2. Stat Tiles */}
        <div
          className="py-4 border-t border-border animate-in fade-in-0 slide-in-from-bottom-2"
          style={{ animationDuration: "400ms", animationDelay: "50ms", animationFillMode: "backwards" }}
        >
          <StatTiles score={selectedScore} targetBrand={targetBrand} />
        </div>

        {/* 3. Factor Breakdown */}
        <div
          className="py-4 border-t border-border animate-in fade-in-0 slide-in-from-bottom-2"
          style={{ animationDuration: "400ms", animationDelay: "100ms", animationFillMode: "backwards" }}
        >
          <SectionHeader title="Factor Breakdown" />
          <FactorBreakdown breakdown={breakdown} weights={weights} />
        </div>

        {/* 4. Comparative Snapshot */}
        <div
          className="py-4 border-t border-border animate-in fade-in-0 slide-in-from-bottom-2"
          style={{ animationDuration: "400ms", animationDelay: "150ms", animationFillMode: "backwards" }}
        >
          <SectionHeader title="Regional Comparison" />
          <ComparativeSnapshot
            selectedScore={selectedScore}
            allScores={allScores}
          />
        </div>

        {/* 5. Insight Card */}
        <div
          className="py-4 border-t border-border animate-in fade-in-0 slide-in-from-bottom-2"
          style={{ animationDuration: "400ms", animationDelay: "200ms", animationFillMode: "backwards" }}
        >
          <SectionHeader title="AI Insight" />
          <InsightCard targetBrand={targetBrand} score={selectedScore} />
        </div>
      </div>
    </div>
  );
};

export default RadarPanel;
