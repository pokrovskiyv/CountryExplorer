import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import type { ScoreBreakdown } from "@/lib/expansion-scoring";
import { getTierColor } from "@/lib/opportunity-colors";
import type { ScoreTier } from "@/lib/expansion-scoring";

interface OpportunityChartProps {
  readonly breakdown: ScoreBreakdown;
  readonly tier: ScoreTier;
}

const AXIS_LABELS: Record<keyof ScoreBreakdown, string> = {
  penetrationGap: "Penetration",
  competitorPresence: "Competition",
  populationScore: "Population",
  densityHeadroom: "Headroom",
};

const OpportunityChart = ({ breakdown, tier }: OpportunityChartProps) => {
  const color = getTierColor(tier);

  const data = (Object.keys(AXIS_LABELS) as (keyof ScoreBreakdown)[]).map((key) => ({
    axis: AXIS_LABELS[key],
    value: breakdown[key],
    fullMark: 100,
  }));

  return (
    <div className="bg-[hsl(230,25%,13%)] rounded-lg p-3">
      <h4 className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">
        Score breakdown
      </h4>
      <ResponsiveContainer width="100%" height={180}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid
            stroke="hsl(230,25%,25%)"
            strokeDasharray="3 3"
          />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "hsl(215,20%,65%)", fontSize: 10 }}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OpportunityChart;
