import type { RegionScore } from "@/lib/expansion-scoring";
import { getTierColor } from "@/lib/opportunity-colors";
import ScoreBadge from "./ScoreBadge";

interface RegionRankingListProps {
  readonly scores: readonly RegionScore[];
  readonly selectedRegion: string | null;
  readonly onSelectRegion: (region: string) => void;
}

const RegionRankingList = ({ scores, selectedRegion, onSelectRegion }: RegionRankingListProps) => (
  <div className="space-y-0.5">
    {scores.map((score, idx) => {
      const isSelected = score.region === selectedRegion;
      return (
        <button
          key={score.region}
          onClick={() => onSelectRegion(score.region)}
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors ${
            isSelected
              ? "bg-blue-600/10 ring-1 ring-blue-500/30"
              : "hover:bg-surface-1"
          }`}
        >
          <span className="text-[11px] text-muted-foreground w-4 shrink-0 tabular-nums text-right">
            {idx + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[12px] text-foreground truncate font-medium">
                {score.region.replace(" (England)", "")}
              </span>
              <ScoreBadge tier={score.tier} />
            </div>
            <div className="w-full h-1.5 bg-surface-1 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${score.composite}%`,
                  background: getTierColor(score.tier),
                }}
              />
            </div>
          </div>
          <span
            className="text-[13px] font-bold tabular-nums w-7 text-right shrink-0"
            style={{ color: getTierColor(score.tier) }}
          >
            {score.composite}
          </span>
        </button>
      );
    })}
  </div>
);

export default RegionRankingList;
