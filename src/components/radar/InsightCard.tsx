import { TrendingUp, AlertTriangle } from "lucide-react";
import type { RegionScore } from "@/lib/expansion-scoring";
import { getTierColor } from "@/lib/opportunity-colors";
import { generateStructuredInsight } from "@/lib/insight-generator";

interface InsightCardProps {
  readonly targetBrand: string;
  readonly score: RegionScore;
}

const InsightCard = ({ targetBrand, score }: InsightCardProps) => {
  const insight = generateStructuredInsight(targetBrand, score);
  const tierColor = getTierColor(score.tier);

  return (
    <div className="bg-surface-1 rounded-lg overflow-hidden">
      {/* Headline + summary with accent border */}
      <div
        className="p-3.5 border-l-[3px]"
        style={{ borderLeftColor: tierColor }}
      >
        <h4
          className="text-[11px] uppercase tracking-wide font-semibold mb-1"
          style={{ color: tierColor }}
        >
          {insight.headline}
        </h4>
        <p className="text-[12px] text-slate-300 leading-relaxed">
          {insight.summary}
        </p>
      </div>

      {/* Strength & Risk */}
      <div className="px-3.5 pb-3.5 space-y-1.5">
        <div className="flex items-start gap-2">
          <TrendingUp size={12} className="text-emerald-400 mt-0.5 shrink-0" />
          <span className="text-[11px] text-slate-300">
            <span className="text-emerald-400 font-medium">Strength:</span>{" "}
            {insight.keyStrength}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
          <span className="text-[11px] text-slate-300">
            <span className="text-amber-400 font-medium">Risk:</span>{" "}
            {insight.keyRisk}
          </span>
        </div>
      </div>
    </div>
  );
};

export default InsightCard;
