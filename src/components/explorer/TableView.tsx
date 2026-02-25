import { useState, useMemo } from "react";
import { Download } from "lucide-react";
import { useCountry } from "@/contexts/CountryContext";
import { exportTableAsCSV } from "@/lib/export-csv";

interface TableViewProps {
  onRegionSelect: (name: string) => void;
}

const TableView = ({ onRegionSelect }: TableViewProps) => {
  const { brands: BRANDS, regionCounts: REGION_COUNTS, population: POPULATION } = useCountry();
  const [sortKey, setSortKey] = useState("total");
  const [sortDesc, setSortDesc] = useState(true);
  const brands = Object.keys(BRANDS);

  const rows = useMemo(() => {
    const data = Object.entries(REGION_COUNTS).map(([name, d]) => {
      const pop = POPULATION[name] || 0;
      const total = d.total || 0;
      return { name, ...d, total, pop, density: pop > 0 ? ((total / pop) * 100) : 0 };
    });

    data.sort((a, b) => {
      const va = sortKey === "name" ? a.name : (parseFloat(String((a as any)[sortKey])) || 0);
      const vb = sortKey === "name" ? b.name : (parseFloat(String((b as any)[sortKey])) || 0);
      if (typeof va === "string" && typeof vb === "string") return sortDesc ? vb.localeCompare(va) : va.localeCompare(vb);
      return sortDesc ? (vb as number) - (va as number) : (va as number) - (vb as number);
    });
    return data;
  }, [sortKey, sortDesc]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const thClass = (key: string) =>
    `text-left px-3 py-2 border-b-2 border-border text-muted-foreground font-semibold uppercase tracking-wide text-[11px] cursor-pointer whitespace-nowrap hover:text-blue-400 ${sortKey === key ? "text-blue-400" : ""}`;

  return (
    <div className="p-4 overflow-auto h-full">
      <div className="flex justify-end mb-3">
        <button
          onClick={() => exportTableAsCSV(BRANDS, REGION_COUNTS, POPULATION)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-surface-1 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={thClass("name")} onClick={() => handleSort("name")}>Region</th>
            <th className={thClass("total")} onClick={() => handleSort("total")}>Total</th>
            <th className={thClass("pop")} onClick={() => handleSort("pop")}>Population</th>
            <th className={thClass("density")} onClick={() => handleSort("density")}>Per 100k</th>
            {brands.map((b) => (
              <th key={b} className={thClass(b)} onClick={() => handleSort(b)}>{b}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="hover:bg-surface-1/50">
              <td className="px-3 py-2 border-b border-surface-2">
                <button onClick={() => onRegionSelect(r.name)} className="text-blue-400 hover:underline">
                  {r.name}
                </button>
              </td>
              <td className="px-3 py-2 border-b border-surface-2 tabular-nums">{r.total}</td>
              <td className="px-3 py-2 border-b border-surface-2 tabular-nums">{(r.pop * 1000).toLocaleString()}</td>
              <td className="px-3 py-2 border-b border-surface-2 tabular-nums">{r.density.toFixed(1)}</td>
              {brands.map((b) => {
                const count = (r as any)[b] || 0;
                const pct = r.total > 0 ? ((count / r.total) * 100).toFixed(1) : "0";
                return (
                  <td key={b} className="px-3 py-2 border-b border-surface-2 tabular-nums">
                    {count} <span className="text-muted-foreground text-[10px]">({pct}%)</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableView;
