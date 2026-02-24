import type { RegionScore } from "@/lib/expansion-scoring";
import { getTierColor } from "@/lib/opportunity-colors";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface ComparativeSnapshotProps {
  readonly selectedScore: RegionScore;
  readonly allScores: readonly RegionScore[];
}

const shortName = (region: string) => region.replace(" (England)", "");

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
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
          Rank among regions
        </span>
        <span className="text-[13px] font-semibold text-slate-200">
          #{rank} of {total}
        </span>
      </div>

      <p className="text-[10px] text-muted-foreground mb-3">
        Each dot is a region — higher = stronger opportunity
      </p>

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
                {/* Selected region label */}
                <span className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-slate-300">
                  {shortName(score.region)} &middot; {score.composite}
                </span>
              </div>
            );
          }

          return (
            <Tooltip key={score.region}>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-help"
                  style={{ left }}
                >
                  <div className="w-2 h-2 rounded-full bg-[hsl(230,15%,35%)]" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-[hsl(230,25%,11%)] border-border text-slate-200 text-xs max-w-[220px] leading-relaxed">
                {shortName(score.region)}: {score.composite}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Axis label */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-[9px] text-muted-foreground">0</span>
        <span className="text-[9px] text-muted-foreground tracking-wider">
          &larr; Expansion Opportunity &rarr;
        </span>
        <span className="text-[9px] text-muted-foreground">100</span>
      </div>
    </div>
  );
};

export default ComparativeSnapshot;
