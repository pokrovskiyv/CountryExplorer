import type { RegionScore } from "@/lib/expansion-scoring";
import { getTierColor } from "@/lib/opportunity-colors";

interface ComparativeSnapshotProps {
  readonly selectedScore: RegionScore;
  readonly allScores: readonly RegionScore[];
}

const ComparativeSnapshot = ({
  selectedScore,
  allScores,
}: ComparativeSnapshotProps) => {
  const sorted = [...allScores].sort((a, b) => b.composite - a.composite);
  const rank = sorted.findIndex((s) => s.region === selectedScore.region) + 1;
  const total = sorted.length;
  const tierColor = getTierColor(selectedScore.tier);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
          Rank among regions
        </span>
        <span className="text-[13px] font-semibold text-slate-200">
          #{rank} of {total}
        </span>
      </div>

      <div className="relative h-8 flex items-center">
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-[hsl(230,25%,18%)] rounded-full" />

        {/* Region dots */}
        {sorted.map((score) => {
          const isSelected = score.region === selectedScore.region;
          const left = `${Math.max(2, Math.min(98, score.composite))}%`;

          if (isSelected) {
            return (
              <div
                key={score.region}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ left }}
              >
                <div
                  className="w-4 h-4 rounded-full border-2 border-[hsl(230,25%,10%)]"
                  style={{
                    background: tierColor,
                    boxShadow: `0 0 8px ${tierColor}60`,
                  }}
                />
              </div>
            );
          }

          return (
            <div
              key={score.region}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left }}
              title={`${score.region.replace(" (England)", "")}: ${score.composite}`}
            >
              <div className="w-2 h-2 rounded-full bg-[hsl(230,15%,35%)]" />
            </div>
          );
        })}
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-muted-foreground">0</span>
        <span className="text-[9px] text-muted-foreground">100</span>
      </div>
    </div>
  );
};

export default ComparativeSnapshot;
