import type { RegionScore } from "./expansion-scoring";

export interface DerivedMetrics {
  readonly brandShare: number;
  readonly qsrPer100k: number;
  readonly brandPer100k: number;
  readonly nationalAvgBrandShare: number;
  readonly nationalAvgQsrDensity: number;
  readonly nationalAvgBrandPer100k: number;
  readonly shareDelta: number;
}

function computeNationalAverages(
  brand: string,
  regionCounts: Record<string, Record<string, number>>,
  population: Record<string, number>
): {
  avgBrandShare: number;
  avgQsrDensity: number;
  avgBrandPer100k: number;
} {
  const regions = Object.keys(regionCounts);
  let totalBrand = 0;
  let totalQsr = 0;
  let totalPop = 0;

  for (const region of regions) {
    totalBrand += regionCounts[region][brand] || 0;
    totalQsr += regionCounts[region].total || 0;
    totalPop += population[region] || 0;
  }

  return {
    avgBrandShare: totalQsr > 0 ? (totalBrand / totalQsr) * 100 : 0,
    avgQsrDensity: totalPop > 0 ? (totalQsr / totalPop) * 100 : 0,
    avgBrandPer100k: totalPop > 0 ? (totalBrand / totalPop) * 100 : 0,
  };
}

export function computeDerivedMetrics(
  score: RegionScore,
  targetBrand: string,
  regionCounts: Record<string, Record<string, number>>,
  population: Record<string, number>
): DerivedMetrics {
  const { brandCount, totalCount, population: pop } = score;
  const { avgBrandShare, avgQsrDensity, avgBrandPer100k } =
    computeNationalAverages(targetBrand, regionCounts, population);

  const brandShare = totalCount > 0 ? (brandCount / totalCount) * 100 : 0;
  const qsrPer100k = pop > 0 ? (totalCount / pop) * 100 : 0;
  const brandPer100k = pop > 0 ? (brandCount / pop) * 100 : 0;

  return {
    brandShare,
    qsrPer100k,
    brandPer100k,
    nationalAvgBrandShare: avgBrandShare,
    nationalAvgQsrDensity: avgQsrDensity,
    nationalAvgBrandPer100k: avgBrandPer100k,
    shareDelta: brandShare - avgBrandShare,
  };
}

export function formatDelta(value: number, unit: string = "pp"): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${unit}`;
}
