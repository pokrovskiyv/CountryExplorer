import { TrendingUp, TrendingDown } from "lucide-react";
import { useCountry } from "@/contexts/CountryContext";
import type { RegionScore } from "@/lib/expansion-scoring";
import { computeDerivedMetrics, formatDelta } from "@/lib/derived-metrics";
import { formatPopulation } from "@/lib/insight-generator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface StatTilesProps {
  readonly score: RegionScore;
  readonly targetBrand: string;
}

interface TileData {
  readonly label: string;
  readonly tooltip: string;
  readonly primary: string;
  readonly secondary: string;
  readonly delta?: number;
  readonly invertDelta?: boolean;
  readonly color?: string;
}

const StatTiles = ({ score, targetBrand }: StatTilesProps) => {
  const { brands: BRANDS, regionCounts, population } = useCountry();
  const metrics = computeDerivedMetrics(score, targetBrand, regionCounts, population);
  const brandColor = BRANDS[targetBrand]?.color || "#3b82f6";

  const tiles: readonly TileData[] = [
    {
      label: "Brand Share",
      tooltip:
        "Percentage of all QSR outlets in this region that belong to the selected brand. A lower share vs the national average indicates room to grow.",
      primary: `${metrics.brandShare.toFixed(1)}%`,
      secondary: `${formatDelta(metrics.shareDelta)} vs avg`,
      delta: metrics.shareDelta,
      invertDelta: true,
      color: brandColor,
    },
    {
      label: "QSR Density",
      tooltip:
        "Total number of quick-service restaurants per 100,000 residents. Shows how saturated the market is overall.",
      primary: `${metrics.qsrPer100k.toFixed(1)} / 100K`,
      secondary: `${score.brandCount} brand \u00B7 ${score.totalCount} total`,
    },
    {
      label: "Brand Density",
      tooltip:
        "Number of the selected brand\u2019s outlets per 100,000 residents, compared to the national average.",
      primary: `${metrics.brandPer100k.toFixed(1)} / 100K`,
      secondary: `vs ${metrics.nationalAvgBrandPer100k.toFixed(1)} avg`,
      color: brandColor,
    },
    {
      label: "Population",
      tooltip:
        "Total population of the region, representing the addressable consumer market.",
      primary: formatPopulation(score.population),
      secondary: "Addressable market",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((tile) => {
        const DeltaIcon = tile.delta !== undefined
          ? (tile.invertDelta ? tile.delta < 0 : tile.delta > 0)
            ? TrendingUp
            : TrendingDown
          : null;

        const deltaPositive = tile.delta !== undefined
          ? (tile.invertDelta ? tile.delta < 0 : tile.delta > 0)
          : false;

        return (
          <div
            key={tile.label}
            className="bg-[hsl(230,25%,13%)] rounded-lg p-2.5"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 cursor-help border-b border-dashed border-muted-foreground/40 w-fit">
                  {tile.label}
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-[hsl(230,25%,11%)] border-border text-slate-200 text-xs max-w-[220px] leading-relaxed">
                {tile.tooltip}
              </TooltipContent>
            </Tooltip>
            <div
              className="text-base font-bold tabular-nums leading-tight"
              style={{ color: tile.color || "hsl(210,40%,98%)" }}
            >
              {tile.primary}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {DeltaIcon && (
                <DeltaIcon
                  size={11}
                  className={deltaPositive ? "text-emerald-400" : "text-amber-400"}
                />
              )}
              <span
                className={`text-[10px] ${
                  tile.delta !== undefined
                    ? deltaPositive
                      ? "text-emerald-400"
                      : "text-amber-400"
                    : "text-muted-foreground"
                }`}
              >
                {tile.secondary}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatTiles;
