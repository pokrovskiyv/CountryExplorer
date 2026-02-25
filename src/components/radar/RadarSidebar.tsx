import { useCountry } from "@/contexts/CountryContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OpportunityWeights, RegionScore } from "@/lib/expansion-scoring";
import { getTierColor } from "@/lib/opportunity-colors";
import WeightSliders from "./WeightSliders";
import RegionRankingList from "./RegionRankingList";
import ScoreBadge from "./ScoreBadge";

interface RadarSidebarProps {
  readonly targetBrand: string;
  readonly onBrandChange: (brand: string) => void;
  readonly weights: OpportunityWeights;
  readonly onWeightsChange: (weights: OpportunityWeights) => void;
  readonly onResetWeights: () => void;
  readonly scores: readonly RegionScore[];
  readonly topOpportunities: readonly RegionScore[];
  readonly selectedRegion: string | null;
  readonly onSelectRegion: (region: string) => void;
}

const RadarSidebar = ({
  targetBrand,
  onBrandChange,
  weights,
  onWeightsChange,
  onResetWeights,
  scores,
  topOpportunities,
  selectedRegion,
  onSelectRegion,
}: RadarSidebarProps) => {
  const { brands: BRANDS } = useCountry();
  const brandNames = Object.keys(BRANDS);

  return (
  <div className="w-80 bg-surface-0 border-r border-border shrink-0 overflow-y-auto flex flex-col">
    {/* Target Brand Selector */}
    <div className="p-4 border-b border-border">
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2.5">
        Target brand
      </h3>
      <Select value={targetBrand} onValueChange={onBrandChange}>
        <SelectTrigger className="bg-surface-1 border-border text-foreground h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-surface-1 border-border">
          {brandNames.map((brand) => (
            <SelectItem key={brand} value={brand} className="text-foreground">
              <span className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: BRANDS[brand].color }}
                />
                {brand}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {/* Weight Sliders */}
    <div className="px-4 py-3 border-b border-border">
      <WeightSliders
        weights={weights}
        onChange={onWeightsChange}
        onReset={onResetWeights}
      />
    </div>

    {/* Top 3 Opportunities */}
    <div className="p-4 border-b border-border">
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2.5">
        Top opportunities
      </h3>
      <div className="space-y-2">
        {topOpportunities.map((opp, idx) => (
          <button
            key={opp.region}
            onClick={() => onSelectRegion(opp.region)}
            className="w-full bg-surface-1 rounded-lg p-3 text-left hover:bg-surface-2 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold tabular-nums"
                  style={{ color: getTierColor(opp.tier) }}
                >
                  #{idx + 1}
                </span>
                <span className="text-[12px] font-medium text-foreground truncate">
                  {opp.region.replace(" (England)", "")}
                </span>
              </div>
              <ScoreBadge tier={opp.tier} />
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1 bg-surface-6 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${opp.composite}%`,
                    background: getTierColor(opp.tier),
                  }}
                />
              </div>
              <span
                className="text-[12px] font-bold tabular-nums"
                style={{ color: getTierColor(opp.tier) }}
              >
                {opp.composite}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>

    {/* All Regions Ranking */}
    <div className="p-4 flex-1 overflow-y-auto">
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2.5">
        All regions
      </h3>
      <RegionRankingList
        scores={scores}
        selectedRegion={selectedRegion}
        onSelectRegion={onSelectRegion}
      />
    </div>
  </div>
  );
};

export default RadarSidebar;
