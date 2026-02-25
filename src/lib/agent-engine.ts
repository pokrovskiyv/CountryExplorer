// Pure agent analysis engine — no side effects
// Three named agents that generate demo insights from snapshot data

import type { Snapshot } from "./alert-engine"
import {
  computeAllRegionScores,
  DEFAULT_WEIGHTS,
  type RegionScore,
} from "./expansion-scoring"
import type { CountryConfig } from "@/contexts/CountryContext"
import { runDeliveryIntel } from "./delivery-intel-agent"

// --- Types ---

export type AgentId = "market-monitor" | "competitor-tracker" | "expansion-scout" | "delivery-intel"

export type MarketInsightType =
  | "rapid-growth"
  | "regional-leader-shift"
  | "market-acceleration"
  | "stagnant-market"
  | "market-leader"

export type CompetitorInsightType =
  | "brand-dominance"
  | "competitive-entry"
  | "flanking-threat"
  | "brand-gap"

export type ExpansionInsightType =
  | "hot-opportunity"
  | "growth-opportunity"
  | "tier-upgrade"
  | "multi-brand-opportunity"
  | "saturated-region-warning"

export type DeliveryInsightType =
  | "platform-coverage-gap"
  | "delivery-desert"
  | "drive-thru-advantage"
  | "own-delivery-dominance"
  | "click-collect-leader"

export type InsightType = MarketInsightType | CompetitorInsightType | ExpansionInsightType | DeliveryInsightType

export interface AgentInsight {
  readonly id: string
  readonly agentId: AgentId
  readonly insightType: InsightType
  readonly message: string
  readonly timestamp: string
  readonly priority: number // 1 (highest) – 5 (lowest)
  readonly read: boolean
  readonly brands: readonly string[]
  readonly region: string
}

export interface AgentDefinition {
  readonly id: AgentId
  readonly name: string
  readonly tagline: string
  readonly color: string
  readonly static?: boolean
  readonly run: (
    prevSnapshot: Snapshot,
    nextSnapshot: Snapshot,
    countryConfig: CountryConfig,
    monthDate: string
  ) => readonly AgentInsight[]
}

// --- Thresholds ---

const RAPID_GROWTH_MIN = 3
const ACCELERATION_FACTOR = 1.5
const DOMINANCE_SHARE_THRESHOLD = 0.35
const COMPETITIVE_ENTRY_RIVAL_MIN = 30
const FLANKING_GROWTH_MIN = 2
const ESTABLISHED_BRAND_MIN_LOCATIONS = 50
const MARKET_LEADER_TOP_REGIONS = 3
const GROWTH_OPPORTUNITY_MIN_SCORE = 45
const GROWTH_OPPORTUNITY_MAX_PER_BRAND = 3

// --- Helpers ---

function makeInsight(
  agentId: AgentId,
  insightType: InsightType,
  message: string,
  timestamp: string,
  priority: number,
  brands: readonly string[],
  region: string
): AgentInsight {
  return {
    id: `${agentId}-${insightType}-${region}-${brands.join(",") || "none"}-${timestamp}`,
    agentId,
    insightType,
    message,
    timestamp,
    priority,
    read: false,
    brands,
    region,
  }
}

function getRegionBrandCount(snapshot: Snapshot, region: string, brand: string): number {
  return snapshot[region]?.[brand] || 0
}

function getRegionTotal(snapshot: Snapshot, region: string): number {
  const brands = snapshot[region]
  if (!brands) return 0
  return Object.values(brands).reduce((sum, count) => sum + count, 0)
}

function getTopBrand(snapshot: Snapshot, region: string): { brand: string; count: number } | null {
  const brands = snapshot[region]
  if (!brands) return null
  let topBrand = ""
  let topCount = 0
  for (const [brand, count] of Object.entries(brands)) {
    if (count > topCount) {
      topBrand = brand
      topCount = count
    }
  }
  return topCount > 0 ? { brand: topBrand, count: topCount } : null
}

// --- Market Monitor Agent ---

function runMarketMonitor(
  prevSnapshot: Snapshot,
  nextSnapshot: Snapshot,
  _countryConfig: CountryConfig,
  monthDate: string
): readonly AgentInsight[] {
  const insights: AgentInsight[] = []
  const regions = Object.keys(nextSnapshot)
  const brands = new Set<string>()
  for (const region of regions) {
    for (const brand of Object.keys(nextSnapshot[region] || {})) {
      brands.add(brand)
    }
  }

  for (const region of regions) {
    // rapid-growth: brand added 3+ locations in a region this month
    for (const brand of brands) {
      const prev = getRegionBrandCount(prevSnapshot, region, brand)
      const next = getRegionBrandCount(nextSnapshot, region, brand)
      const growth = next - prev

      if (growth >= RAPID_GROWTH_MIN) {
        insights.push(
          makeInsight(
            "market-monitor",
            "rapid-growth",
            `${brand} added ${growth} locations in ${region} this month (now ${next})`,
            monthDate,
            2,
            [brand],
            region
          )
        )
      }
    }

    // regional-leader-shift: top brand in a region changed
    const prevTop = getTopBrand(prevSnapshot, region)
    const nextTop = getTopBrand(nextSnapshot, region)
    if (prevTop && nextTop && prevTop.brand !== nextTop.brand) {
      insights.push(
        makeInsight(
          "market-monitor",
          "regional-leader-shift",
          `${nextTop.brand} overtook ${prevTop.brand} as the leading brand in ${region} (${nextTop.count} vs ${getRegionBrandCount(nextSnapshot, region, prevTop.brand)})`,
          monthDate,
          1,
          [nextTop.brand, prevTop.brand],
          region
        )
      )
    }

    // stagnant-market: region with zero net openings
    const prevTotal = getRegionTotal(prevSnapshot, region)
    const nextTotal = getRegionTotal(nextSnapshot, region)
    if (prevTotal > 0 && nextTotal === prevTotal) {
      insights.push(
        makeInsight(
          "market-monitor",
          "stagnant-market",
          `${region} had zero net openings this month (${nextTotal} total locations)`,
          monthDate,
          4,
          [],
          region
        )
      )
    }
  }

  // market-acceleration: brand growing faster than national average
  for (const brand of brands) {
    let totalPrevBrand = 0
    let totalNextBrand = 0
    let totalPrevAll = 0
    let totalNextAll = 0

    for (const region of regions) {
      totalPrevBrand += getRegionBrandCount(prevSnapshot, region, brand)
      totalNextBrand += getRegionBrandCount(nextSnapshot, region, brand)
      totalPrevAll += getRegionTotal(prevSnapshot, region)
      totalNextAll += getRegionTotal(nextSnapshot, region)
    }

    const brandGrowth = totalNextBrand - totalPrevBrand
    const allBrandsCount = brands.size
    const avgGrowth = allBrandsCount > 0 ? (totalNextAll - totalPrevAll) / allBrandsCount : 0

    if (brandGrowth > 0 && avgGrowth > 0 && brandGrowth > avgGrowth * ACCELERATION_FACTOR) {
      insights.push(
        makeInsight(
          "market-monitor",
          "market-acceleration",
          `${brand} is growing 50%+ faster than average (+${brandGrowth} vs avg +${Math.round(avgGrowth)})`,
          monthDate,
          2,
          [brand],
          "National"
        )
      )
    }
  }

  // market-leader: identify the leading brand in the largest regions (state-based)
  const regionsBySize = [...regions]
    .map((r) => ({ region: r, total: getRegionTotal(nextSnapshot, r) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, MARKET_LEADER_TOP_REGIONS)

  for (const { region, total } of regionsBySize) {
    const top = getTopBrand(nextSnapshot, region)
    if (top && total > 0) {
      const share = Math.round((top.count / total) * 100)
      insights.push(
        makeInsight(
          "market-monitor",
          "market-leader",
          `${top.brand} leads ${region} with ${top.count} locations (${share}% of ${total})`,
          monthDate,
          3,
          [top.brand],
          region
        )
      )
    }
  }

  return insights
}

// --- Competitor Tracker Agent ---

function runCompetitorTracker(
  prevSnapshot: Snapshot,
  nextSnapshot: Snapshot,
  _countryConfig: CountryConfig,
  monthDate: string
): readonly AgentInsight[] {
  const insights: AgentInsight[] = []
  const regions = Object.keys(nextSnapshot)
  const brands = new Set<string>()
  for (const region of regions) {
    for (const brand of Object.keys(nextSnapshot[region] || {})) {
      brands.add(brand)
    }
  }

  for (const region of regions) {
    const regionTotal = getRegionTotal(nextSnapshot, region)

    for (const brand of brands) {
      const brandCount = getRegionBrandCount(nextSnapshot, region, brand)

      // brand-dominance: brand controls >35% share in a region
      if (regionTotal > 0 && brandCount / regionTotal > DOMINANCE_SHARE_THRESHOLD) {
        const share = Math.round((brandCount / regionTotal) * 100)
        insights.push(
          makeInsight(
            "competitor-tracker",
            "brand-dominance",
            `${brand} controls ${share}% market share in ${region} (${brandCount}/${regionTotal} locations)`,
            monthDate,
            2,
            [brand],
            region
          )
        )
      }

      // competitive-entry: brand enters region where rival has >30 locations
      const prevCount = getRegionBrandCount(prevSnapshot, region, brand)
      if (prevCount === 0 && brandCount > 0) {
        for (const rival of brands) {
          if (rival === brand) continue
          const rivalCount = getRegionBrandCount(nextSnapshot, region, rival)
          if (rivalCount > COMPETITIVE_ENTRY_RIVAL_MIN) {
            insights.push(
              makeInsight(
                "competitor-tracker",
                "competitive-entry",
                `${brand} entered ${region} where ${rival} has ${rivalCount} locations`,
                monthDate,
                1,
                [brand, rival],
                region
              )
            )
          }
        }
      }
    }

    // flanking-threat: two brands both growing in same region
    const growingBrands: { brand: string; growth: number }[] = []
    for (const brand of brands) {
      const prev = getRegionBrandCount(prevSnapshot, region, brand)
      const next = getRegionBrandCount(nextSnapshot, region, brand)
      if (next - prev >= FLANKING_GROWTH_MIN) {
        growingBrands.push({ brand, growth: next - prev })
      }
    }
    if (growingBrands.length >= 2) {
      const sorted = [...growingBrands].sort((a, b) => b.growth - a.growth)
      const top2 = sorted.slice(0, 2)
      insights.push(
        makeInsight(
          "competitor-tracker",
          "flanking-threat",
          `${top2[0].brand} (+${top2[0].growth}) and ${top2[1].brand} (+${top2[1].growth}) are both expanding in ${region}`,
          monthDate,
          3,
          [top2[0].brand, top2[1].brand],
          region
        )
      )
    }

    // brand-gap: established brand absent from a region
    for (const brand of brands) {
      const count = getRegionBrandCount(nextSnapshot, region, brand)
      if (count === 0) {
        let totalNational = 0
        for (const r of regions) {
          totalNational += getRegionBrandCount(nextSnapshot, r, brand)
        }
        if (totalNational > ESTABLISHED_BRAND_MIN_LOCATIONS) {
          insights.push(
            makeInsight(
              "competitor-tracker",
              "brand-gap",
              `${brand} has ${totalNational} national locations but is absent from ${region}`,
              monthDate,
              3,
              [brand],
              region
            )
          )
        }
      }
    }
  }

  return insights
}

// --- Expansion Scout Agent ---

function runExpansionScout(
  prevSnapshot: Snapshot,
  nextSnapshot: Snapshot,
  countryConfig: CountryConfig,
  monthDate: string
): readonly AgentInsight[] {
  const insights: AgentInsight[] = []
  const brands = Object.keys(countryConfig.brands)

  // Build scoring data from the current snapshot
  const snapshotScoringData = buildScoringDataFromSnapshot(nextSnapshot, countryConfig)
  const prevScoringData = buildScoringDataFromSnapshot(prevSnapshot, countryConfig)

  // Cache scores per brand to avoid redundant computation
  const scoresByBrand = new Map<string, readonly RegionScore[]>()
  // Track hot regions per brand for multi-brand-opportunity (immutable accumulation)
  let hotRegions: Record<string, readonly string[]> = {}

  for (const brand of brands) {
    const scores = computeAllRegionScores(brand, DEFAULT_WEIGHTS, snapshotScoringData)
    const prevScores = computeAllRegionScores(brand, DEFAULT_WEIGHTS, prevScoringData)
    scoresByBrand.set(brand, scores)
    const prevTierMap = new Map(prevScores.map((s) => [s.region, s.tier]))

    for (const score of scores) {
      // hot-opportunity: region scores Hot tier
      if (score.tier === "Hot") {
        insights.push(
          makeInsight(
            "expansion-scout",
            "hot-opportunity",
            `${score.region} is a Hot opportunity for ${brand} (score: ${score.composite})`,
            monthDate,
            2,
            [brand],
            score.region
          )
        )

        hotRegions = {
          ...hotRegions,
          [score.region]: [...(hotRegions[score.region] || []), brand],
        }
      }

      // tier-upgrade: region moved from Warm→Hot between snapshots
      const prevTier = prevTierMap.get(score.region)
      if (prevTier && prevTier === "Warm" && score.tier === "Hot") {
        insights.push(
          makeInsight(
            "expansion-scout",
            "tier-upgrade",
            `${score.region} upgraded from Warm to Hot for ${brand} (score: ${score.composite})`,
            monthDate,
            1,
            [brand],
            score.region
          )
        )
      }
    }

    // growth-opportunity: top-scoring non-Hot regions above minimum threshold
    const nonHotAboveMin = scores
      .filter((s) => s.tier !== "Hot" && s.composite >= GROWTH_OPPORTUNITY_MIN_SCORE)
      .slice(0, GROWTH_OPPORTUNITY_MAX_PER_BRAND)

    for (const score of nonHotAboveMin) {
      insights.push(
        makeInsight(
          "expansion-scout",
          "growth-opportunity",
          `${score.region} shows growth potential for ${brand} (score: ${score.composite}, ${score.tier})`,
          monthDate,
          3,
          [brand],
          score.region
        )
      )
    }
  }

  // multi-brand-opportunity: region is Hot for 2+ brands
  for (const [region, regionBrands] of Object.entries(hotRegions)) {
    if (regionBrands.length >= 2) {
      insights.push(
        makeInsight(
          "expansion-scout",
          "multi-brand-opportunity",
          `${region} is a Hot opportunity for ${regionBrands.length} brands: ${regionBrands.join(", ")}`,
          monthDate,
          1,
          regionBrands,
          region
        )
      )
    }
  }

  // saturated-region-warning: all brands score Cold in a region (reuses cached scores)
  const regionNames = Object.keys(countryConfig.regionCounts)
  for (const region of regionNames) {
    const allCold = brands.every((brand) => {
      const scores = scoresByBrand.get(brand)
      if (!scores) return true
      const regionScore = scores.find((s) => s.region === region)
      return regionScore ? regionScore.tier === "Cold" : true
    })
    if (allCold) {
      insights.push(
        makeInsight(
          "expansion-scout",
          "saturated-region-warning",
          `${region} scores Cold for all brands — market may be saturated`,
          monthDate,
          4,
          [],
          region
        )
      )
    }
  }

  return insights
}

interface SnapshotScoringData {
  readonly brands: Record<string, { color: string; icon: string }>
  readonly regionCounts: Record<string, Record<string, number>>
  readonly population: Record<string, number>
}

/** Build ScoringData compatible with expansion-scoring from a snapshot */
function buildScoringDataFromSnapshot(
  snapshot: Snapshot,
  countryConfig: CountryConfig
): SnapshotScoringData {
  const regionCounts: Record<string, Record<string, number>> = {}

  for (const [region, brands] of Object.entries(snapshot)) {
    const counts: Record<string, number> = { ...brands }
    counts.total = Object.values(brands).reduce((sum, c) => sum + c, 0)
    regionCounts[region] = counts
  }

  // Include regions from config that might not be in snapshot yet
  for (const region of Object.keys(countryConfig.population)) {
    if (!regionCounts[region]) {
      regionCounts[region] = { total: 0 }
    }
  }

  return {
    brands: countryConfig.brands,
    regionCounts,
    population: countryConfig.population,
  }
}

// --- Agent Definitions ---

export const AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  {
    id: "market-monitor",
    name: "Market Monitor",
    tagline: "Tracks growth trends and market dynamics",
    color: "emerald",
    run: runMarketMonitor,
  },
  {
    id: "competitor-tracker",
    name: "Competitor Tracker",
    tagline: "Identifies competitive threats and openings",
    color: "red",
    run: runCompetitorTracker,
  },
  {
    id: "expansion-scout",
    name: "Expansion Scout",
    tagline: "Discovers expansion opportunities",
    color: "purple",
    run: runExpansionScout,
  },
  {
    id: "delivery-intel",
    name: "Delivery Intel",
    tagline: "Analyzes delivery platform coverage and format mix",
    color: "blue",
    static: true,
    run: (_prev, _next, countryConfig) => runDeliveryIntel(countryConfig),
  },
]

// --- Top-level runner ---

export function runAllAgents(
  prevSnapshot: Snapshot,
  nextSnapshot: Snapshot,
  countryConfig: CountryConfig,
  monthDate: string
): readonly AgentInsight[] {
  const allInsights: AgentInsight[] = []

  for (const agent of AGENT_DEFINITIONS) {
    if (agent.static) continue // static agents run once on mount, not per tick
    const agentInsights = agent.run(prevSnapshot, nextSnapshot, countryConfig, monthDate)
    allInsights.push(...agentInsights)
  }

  // Sort by priority (1 = highest), then by agent order
  return [...allInsights].sort((a, b) => a.priority - b.priority)
}
