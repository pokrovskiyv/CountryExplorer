import type { BrandInfo } from "@/contexts/CountryContext"

export function exportTableAsCSV(
  brands: Record<string, BrandInfo>,
  regionCounts: Record<string, Record<string, number>>,
  population: Record<string, number>
): void {
  const brandNames = Object.keys(brands);
  const BOM = "\uFEFF";
  const sep = ",";

  const headers = ["Region", "Total", "Population", "Per 100k people", ...brandNames];
  const rows = Object.entries(regionCounts).map(([name, data]) => {
    const pop = population[name] || 0;
    const total = data.total || 0;
    const density = pop > 0 ? ((total / pop) * 100).toFixed(1) : "0";
    const brandCols = brandNames.map((b) => String(data[b] || 0));
    return [name, String(total), String(pop * 1000), density, ...brandCols];
  });

  const csv =
    BOM +
    [headers.join(sep), ...rows.map((r) => r.map((c) => `"${c}"`).join(sep))].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `getplace-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
