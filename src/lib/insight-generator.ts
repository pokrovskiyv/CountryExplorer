import type { RegionScore, ScoreBreakdown } from "./expansion-scoring";

type SubScoreKey = keyof ScoreBreakdown;

const SUB_SCORE_LABELS: Record<SubScoreKey, string> = {
  penetrationGap: "penetration gap",
  competitorPresence: "competitor presence",
  populationScore: "population size",
  densityHeadroom: "density headroom",
};

function getDominantFactor(breakdown: ScoreBreakdown): SubScoreKey {
  const entries: [SubScoreKey, number][] = [
    ["penetrationGap", breakdown.penetrationGap],
    ["competitorPresence", breakdown.competitorPresence],
    ["populationScore", breakdown.populationScore],
    ["densityHeadroom", breakdown.densityHeadroom],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function getWeakestFactor(breakdown: ScoreBreakdown): SubScoreKey {
  const entries: [SubScoreKey, number][] = [
    ["penetrationGap", breakdown.penetrationGap],
    ["competitorPresence", breakdown.competitorPresence],
    ["populationScore", breakdown.populationScore],
    ["densityHeadroom", breakdown.densityHeadroom],
  ];
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
}

/** Format population (in thousands) as human-readable string */
export function formatPopulation(pop: number): string {
  return pop >= 1000 ? `${(pop / 1000).toFixed(1)}M` : `${pop}K`;
}

export function generateInsight(brand: string, score: RegionScore): string {
  const { region, composite, tier, breakdown, brandCount, population } = score;
  const dominant = getDominantFactor(breakdown);
  const weakest = getWeakestFactor(breakdown);
  const pop = formatPopulation(population);

  if (tier === "Hot") {
    if (dominant === "penetrationGap") {
      return `${region} is a top-tier opportunity for ${brand}. With only ${brandCount} locations serving ${pop} people, penetration is well below the national average. Competitors have already validated demand here — ${brand} is significantly under-indexed.`;
    }
    if (dominant === "densityHeadroom") {
      return `${region} stands out as a high-opportunity market. The overall QSR density is low relative to the population of ${pop}, leaving substantial room for ${brand} to expand. Strong competitive presence confirms market viability.`;
    }
    return `${region} scores ${composite} — a prime expansion target for ${brand}. The combination of ${SUB_SCORE_LABELS[dominant]} and large addressable market (${pop}) makes this a compelling opportunity with limited downside risk.`;
  }

  if (tier === "Warm") {
    return `${region} shows solid potential (score: ${composite}). ${brand} has ${brandCount} locations across a ${pop} market. The primary driver is ${SUB_SCORE_LABELS[dominant]}, though ${SUB_SCORE_LABELS[weakest]} may warrant consideration before committing resources.`;
  }

  if (tier === "Moderate") {
    return `${region} presents a moderate opportunity (score: ${composite}). The ${pop} market has ${brandCount} ${brand} locations. While ${SUB_SCORE_LABELS[dominant]} is favorable, the overall case is balanced — deeper market research is recommended.`;
  }

  if (tier === "Cool") {
    return `${region} is a lower-priority market for ${brand} (score: ${composite}). With ${brandCount} locations already serving ${pop} people, the main limitation is ${SUB_SCORE_LABELS[weakest]}. Other regions offer stronger expansion fundamentals.`;
  }

  return `${region} appears largely saturated for ${brand} (score: ${composite}). The ${brandCount} existing locations already serve the ${pop} market effectively. ${SUB_SCORE_LABELS[weakest]} is the key constraint. Consider optimizing existing locations rather than expanding.`;
}
