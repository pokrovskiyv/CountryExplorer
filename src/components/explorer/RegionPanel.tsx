import { BRANDS, REGION_COUNTS, POPULATION } from "@/data/uk-data";
import { aggregateCitiesForRegion } from "@/lib/city-aggregation";
import CityBreakdown from "@/components/explorer/CityBreakdown";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts";

interface RegionPanelProps {
  region: string | null;
  onClose: () => void;
  selectedBrands: ReadonlySet<string>;
}

const RegionPanel = ({ region, onClose, selectedBrands }: RegionPanelProps) => {
  if (!region) {
    return (
      <div className="w-[380px] bg-[hsl(230,25%,10%)] border-l border-border shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold">Select a region</h2>
        </div>
        <div className="p-4">
          <p className="text-muted-foreground text-[13px]">Click on a region on the map to see detailed brand breakdown.</p>
        </div>
      </div>
    );
  }

  const data = REGION_COUNTS[region];
  if (!data) return null;

  const pop = POPULATION[region] || 0;
  const total = data.total || 0;
  const density = pop > 0 ? ((total / pop) * 100).toFixed(1) : "—";
  const brands = Object.keys(BRANDS).sort((a, b) => (data[b] || 0) - (data[a] || 0));
  const maxBrand = Math.max(...brands.map((b) => data[b] || 0));

  const chartData = brands.map((b) => ({ name: b, value: data[b] || 0, color: BRANDS[b].color }));

  const cities = aggregateCitiesForRegion(region, selectedBrands);

  return (
    <div className="w-[380px] bg-[hsl(230,25%,10%)] border-l border-border shrink-0 overflow-y-auto">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-base font-semibold">{region}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg px-1">×</button>
      </div>
      <div className="p-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-[hsl(230,25%,13%)] rounded-lg p-3">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Total locations</div>
            <div className="text-xl font-bold text-foreground tabular-nums">{total.toLocaleString()}</div>
          </div>
          <div className="bg-[hsl(230,25%,13%)] rounded-lg p-3">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Per 100k pop.</div>
            <div className="text-xl font-bold text-foreground tabular-nums">{density}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Pop: {(pop * 1000).toLocaleString()}</div>
          </div>
        </div>

        {/* Brand bars */}
        <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2.5">Brand breakdown</h4>
        {brands.map((b) => {
          const count = data[b] || 0;
          const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
          const width = maxBrand > 0 ? (count / maxBrand) * 100 : 0;
          return (
            <div key={b} className="flex items-center gap-2 py-1.5">
              <span className="text-xs w-20 shrink-0 text-slate-300">{b}</span>
              <div className="flex-1 h-5 bg-[hsl(230,25%,13%)] rounded overflow-hidden relative">
                <div className="h-full rounded transition-all duration-400 min-w-[2px]" style={{ width: `${width}%`, background: BRANDS[b].color }} />
              </div>
              <span className="text-[11px] text-muted-foreground w-[50px] text-right shrink-0 tabular-nums">
                {count} ({pct}%)
              </span>
            </div>
          );
        })}

        {/* Doughnut chart */}
        <div className="bg-[hsl(230,25%,13%)] rounded-lg p-4 mt-4">
          <h4 className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Market share</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" stroke="hsl(230,25%,10%)" strokeWidth={2}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-muted-foreground text-[11px]">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* City breakdown */}
        <div className="mt-4">
          <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2.5">Cities</h4>
          <CityBreakdown cities={cities} selectedBrands={selectedBrands} />
        </div>
      </div>
    </div>
  );
};

export default RegionPanel;
