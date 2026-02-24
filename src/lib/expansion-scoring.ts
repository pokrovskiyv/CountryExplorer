import { BRANDS, REGION_COUNTS, POPULATION } from "@/data/uk-data";

// --- Types ---

export interface OpportunityWeights {
  readonly penetrationGap: number;
  readonly competitorPresence: number;
  readonly populationScore: number;
  readonly densityHeadroom: number;
}

export interface ScoreBreakdown {
  readonly penetrationGap: number;
  readonly competitorPresence: number;
  readonly populationScore: number;
  readonly densityHeadroom: number;
}

export type ScoreTier = "Hot" | "Warm" | "Moderate" | "Cool" | "Cold";

export interface RegionScore {
  readonly region: string;
  readonly composite: number;
  readonly tier: ScoreTier;
  readonly breakdown: ScoreBreakdown;
  readonly brandCount: number;
  readonly totalCount: number;
  readonly population: number;
}

export const DEFAULT_WEIGHTS: OpportunityWeights = {
  penetrationGap: 35,
  competitorPresence: 25,
  populationScore: 20,
  densityHeadroom: 20,
};

// --- Helpers ---

const brandNames = Object.keys(BRANDS);
const regionNames = Object.keys(REGION_COUNTS);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// --- Sub-score functions (all return 0-100) ---

/** How much lower is this brand's density vs national average? Higher = more opportunity */
export function computePenetrationGap(brand: string): Record<string, number> {
  const densities: Record<string, number> = {};
  let totalBrandCount = 0;
  let totalPopulation = 0;

  for (const region of regionNames) {
    const count = REGION_COUNTS[region][brand] || 0;
    const pop = POPULATION[region] || 1;
    densities[region] = count / pop;
    totalBrandCount += count;
    totalPopulation += pop;
  }

  const nationalAvgDensity = totalPopulation > 0 ? totalBrandCount / totalPopulation : 0;

  const scores: Record<string, number> = {};
  for (const region of regionNames) {
    if (nationalAvgDensity === 0) {
      scores[region] = 100;
    } else {
      const gap = 1 - densities[region] / nationalAvgDensity;
      scores[region] = clamp(gap * 100, 0, 100);
    }
  }
  return scores;
}

/** Are competitors present? Validates market demand. Higher = more competitors = more validated */
export function computeCompetitorPresence(brand: string): Record<string, number> {
  const otherBrands = brandNames.filter((b) => b !== brand);

  // Single pass: compute all competitor densities and find max
  const competitorDensities: Record<string, number> = {};
  let maxCompDensity = 0;

  for (const region of regionNames) {
    const pop = POPULATION[region] || 1;
    let density = 0;
    for (const other of otherBrands) {
      density += (REGION_COUNTS[region][other] || 0) / pop;
    }
    competitorDensities[region] = density;
    if (density > maxCompDensity) maxCompDensity = density;
  }

  // Normalize against max
  const scores: Record<string, number> = {};
  for (const region of regionNames) {
    scores[region] = maxCompDensity > 0
      ? clamp((competitorDensities[region] / maxCompDensity) * 100, 0, 100)
      : 50;
  }
  return scores;
}

/** Larger population = larger addressable market. Normalized across regions */
export function computePopulationScore(): Record<string, number> {
  const maxPop = Math.max(...regionNames.map((r) => POPULATION[r] || 0));
  const scores: Record<string, number> = {};
  for (const region of regionNames) {
    scores[region] = maxPop > 0
      ? clamp(((POPULATION[region] || 0) / maxPop) * 100, 0, 100)
      : 0;
  }
  return scores;
}

/** Overall market under-saturation. Higher = fewer total QSR per capita */
export function computeDensityHeadroom(): Record<string, number> {
  const densities: Record<string, number> = {};
  let maxDensity = 0;

  for (const region of regionNames) {
    const total = REGION_COUNTS[region].total || 0;
    const pop = POPULATION[region] || 1;
    densities[region] = total / pop;
    if (densities[region] > maxDensity) maxDensity = densities[region];
  }

  const scores: Record<string, number> = {};
  for (const region of regionNames) {
    scores[region] = maxDensity > 0
      ? clamp((1 - densities[region] / maxDensity) * 100, 0, 100)
      : 50;
  }
  return scores;
}

// --- Composite scoring ---

export function computeOpportunityScore(
  breakdown: ScoreBreakdown,
  weights: OpportunityWeights
): number {
  const totalWeight = weights.penetrationGap + weights.competitorPresence +
    weights.populationScore + weights.densityHeadroom;

  if (totalWeight === 0) return 0;

  const weighted =
    breakdown.penetrationGap * weights.penetrationGap +
    breakdown.competitorPresence * weights.competitorPresence +
    breakdown.populationScore * weights.populationScore +
    breakdown.densityHeadroom * weights.densityHeadroom;

  return clamp(weighted / totalWeight, 0, 100);
}

export function getScoreTier(score: number): ScoreTier {
  if (score >= 80) return "Hot";
  if (score >= 60) return "Warm";
  if (score >= 40) return "Moderate";
  if (score >= 20) return "Cool";
  return "Cold";
}

export function computeAllRegionScores(
  targetBrand: string,
  weights: OpportunityWeights
): readonly RegionScore[] {
  const penetrationScores = computePenetrationGap(targetBrand);
  const competitorScores = computeCompetitorPresence(targetBrand);
  const populationScores = computePopulationScore();
  const headroomScores = computeDensityHeadroom();

  const results: RegionScore[] = regionNames.map((region) => {
    const breakdown: ScoreBreakdown = {
      penetrationGap: Math.round(penetrationScores[region]),
      competitorPresence: Math.round(competitorScores[region]),
      populationScore: Math.round(populationScores[region]),
      densityHeadroom: Math.round(headroomScores[region]),
    };

    const composite = Math.round(computeOpportunityScore(breakdown, weights));

    return {
      region,
      composite,
      tier: getScoreTier(composite),
      breakdown,
      brandCount: REGION_COUNTS[region][targetBrand] || 0,
      totalCount: REGION_COUNTS[region].total || 0,
      population: POPULATION[region] || 0,
    };
  });

  return results.sort((a, b) => b.composite - a.composite);
}
