import { BRANDS, REGION_COUNTS, POPULATION } from "@/data/uk-data";

export function exportTableAsCSV(): void {
  const brands = Object.keys(BRANDS);
  const BOM = "\uFEFF";
  const sep = ",";

  const headers = ["Region", "Total", "Population", "Per 100k", ...brands];
  const rows = Object.entries(REGION_COUNTS).map(([name, data]) => {
    const pop = POPULATION[name] || 0;
    const total = data.total || 0;
    const density = pop > 0 ? ((total / pop) * 100).toFixed(1) : "0";
    const brandCols = brands.map((b) => String(data[b] || 0));
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
