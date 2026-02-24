import { REGION_COUNTS, POPULATION } from "@/data/uk-data";
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

function computeNationalAverages(brand: string): {
  avgBrandShare: number;
  avgQsrDensity: number;
  avgBrandPer100k: number;
} {
  const regions = Object.keys(REGION_COUNTS);
  let totalBrand = 0;
  let totalQsr = 0;
  let totalPop = 0;

  for (const region of regions) {
    totalBrand += REGION_COUNTS[region][brand] || 0;
    totalQsr += REGION_COUNTS[region].total || 0;
    totalPop += POPULATION[region] || 0;
  }

  return {
    avgBrandShare: totalQsr > 0 ? (totalBrand / totalQsr) * 100 : 0,
    avgQsrDensity: totalPop > 0 ? (totalQsr / totalPop) * 100 : 0,
    avgBrandPer100k: totalPop > 0 ? (totalBrand / totalPop) * 100 : 0,
  };
}

export function computeDerivedMetrics(
  score: RegionScore,
  targetBrand: string
): DerivedMetrics {
  const { brandCount, totalCount, population } = score;
  const { avgBrandShare, avgQsrDensity, avgBrandPer100k } =
    computeNationalAverages(targetBrand);

  const brandShare = totalCount > 0 ? (brandCount / totalCount) * 100 : 0;
  const qsrPer100k = population > 0 ? (totalCount / population) * 100 : 0;
  const brandPer100k = population > 0 ? (brandCount / population) * 100 : 0;

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
