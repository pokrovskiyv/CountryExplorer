import { useCountry } from "@/contexts/CountryContext";
import BrandGroupManager from "@/components/explorer/BrandGroupManager";
import type { BrandGroup } from "@/hooks/useBrandGroups";

type Metric = "total" | "density" | "share";
type Display = "choropleth" | "points" | "both" | "heatmap";

interface SidebarProps {
  selectedBrands: Set<string>;
  onToggleBrand: (brand: string, checked: boolean) => void;
  metric: Metric;
  onMetricChange: (m: Metric) => void;
  display: Display;
  onDisplayChange: (d: Display) => void;
  brandGroups: readonly BrandGroup[];
  onApplyBrandGroup: (brands: readonly string[]) => void;
  onCreateBrandGroup: (name: string, brands: readonly string[]) => void;
  onDeleteBrandGroup: (id: string) => void;
  visibleIndices?: Record<string, ReadonlySet<number>>;
}

const Sidebar = ({ selectedBrands, onToggleBrand, metric, onMetricChange, display, onDisplayChange, brandGroups, onApplyBrandGroup, onCreateBrandGroup, onDeleteBrandGroup, visibleIndices }: SidebarProps) => {
  const { brands: BRANDS, regionCounts: REGION_COUNTS, population: POPULATION } = useCountry();
  // Compute totals — use visibleIndices when available, fall back to static REGION_COUNTS
  const totals: Record<string, number> = {};
  Object.keys(BRANDS).forEach((b) => {
    if (visibleIndices) {
      totals[b] = visibleIndices[b]?.size ?? 0;
    } else {
      totals[b] = 0;
      Object.values(REGION_COUNTS).forEach((rc) => { totals[b] += rc[b] || 0; });
    }
  });
  const sorted = Object.keys(BRANDS).sort((a, b) => totals[b] - totals[a]);

  // Country summary
  let totalLocations = 0;
  selectedBrands.forEach((b) => {
    totalLocations += totals[b] || 0;
  });
  const totalPop = Object.values(POPULATION).reduce((a, b) => a + b, 0);

  return (
    <div className="w-80 bg-surface-0 border-r border-border overflow-y-auto shrink-0">
      {/* Brand groups */}
      <div className="p-4 border-b border-border">
        <BrandGroupManager
          groups={brandGroups}
          onApplyGroup={onApplyBrandGroup}
          onCreateGroup={onCreateBrandGroup}
          onDeleteGroup={onDeleteBrandGroup}
          currentBrands={selectedBrands}
        />
      </div>

      {/* Brands */}
      <div className="p-4 border-b border-border">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Brands</h3>
        {sorted.map((b) => (
          <label key={b} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer hover:bg-surface-1 mb-0.5 transition-opacity ${selectedBrands.has(b) ? "" : "opacity-40"}`}>
            <input
              type="checkbox"
              checked={selectedBrands.has(b)}
              onChange={(e) => onToggleBrand(b, e.target.checked)}
              className="hidden"
            />
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 border-2 transition-shadow"
              style={{
                background: BRANDS[b].color,
                borderColor: selectedBrands.has(b) ? BRANDS[b].color : 'transparent',
                boxShadow: selectedBrands.has(b) ? `0 0 0 2px ${BRANDS[b].color}33` : 'none',
              }}
            />
            <span className="text-[13px] font-medium flex-1">{b}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{totals[b].toLocaleString()}</span>
          </label>
        ))}
      </div>

      {/* Metric selector */}
      <div className="p-4 border-b border-border">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Color by</h3>
        <div className="flex gap-1 flex-wrap">
          {([["total", "Total locations"], ["density", "Per 100k pop."], ["share", "Brand share %"]] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => onMetricChange(m)}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors border ${
                metric === m
                  ? "bg-blue-600/10 border-blue-600 text-blue-400"
                  : "bg-surface-1 border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Display mode */}
      <div className="p-4 border-b border-border">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Display</h3>
        <div className="flex gap-1 flex-wrap">
          {([["choropleth", "Regions"], ["points", "Points"], ["both", "Both"], ["heatmap", "Heatmap"]] as const).map(([d, label]) => (
            <button
              key={d}
              onClick={() => onDisplayChange(d)}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors border ${
                display === d
                  ? "bg-blue-600/10 border-blue-600 text-blue-400"
                  : "bg-surface-1 border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Country summary */}
      <div className="p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Country Summary</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Locations", value: totalLocations.toLocaleString() },
            { label: "Brands", value: selectedBrands.size },
            { label: "Regions", value: Object.keys(REGION_COUNTS).length },
            { label: "Per 100k", value: ((totalLocations / totalPop) * 100).toFixed(1) },
          ].map((s) => (
            <div key={s.label} className="bg-surface-1 rounded-lg p-3">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
              <div className="text-xl font-bold text-foreground mt-0.5 tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
