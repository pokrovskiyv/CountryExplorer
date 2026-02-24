import type { ScoreTier } from "@/lib/expansion-scoring";
import { getTierColor, getTierBgColor } from "@/lib/opportunity-colors";

interface ScoreBadgeProps {
  readonly tier: ScoreTier;
  readonly className?: string;
}

const ScoreBadge = ({ tier, className = "" }: ScoreBadgeProps) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${className}`}
    style={{
      color: getTierColor(tier),
      background: getTierBgColor(tier),
    }}
  >
    {tier}
  </span>
);

export default ScoreBadge;
