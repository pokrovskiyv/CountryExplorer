// Delivery Intel agent — static (non-temporal) agent analyzing delivery platform
// coverage and format mix across regions and brands

import type { AgentInsight, InsightType, AgentId } from "./agent-engine"
import type { CountryConfig } from "@/contexts/CountryContext"
import {
  buildDeliverySnapshot,
  computeNationalStats,
  type DeliverySnapshot,
} from "./delivery-aggregation"

// --- Thresholds ---

const PLATFORM_GAP_PP = 20 // percentage-point gap to trigger coverage gap
const DESERT_THRESHOLD = 0.40 // region avg third-party penetration below 40%
const DRIVE_THRU_GAP_PP = 25 // pp gap for drive-thru advantage
const OWN_DELIVERY_HIGH = 0.80 // brand >80% own delivery nationally
const OWN_DELIVERY_NO_AGGREGATOR = 0.10 // <10% any aggregator
const CLICK_COLLECT_LEADER = 0.90 // >90% click & collect penetration
const MAX_DELIVERY_INSIGHTS = 10 // cap total to avoid flooding the feed
const MAX_PER_TYPE = 2 // cap per insight type to ensure diversity

// --- Helpers ---

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

/** Convert a 0-1 rate to a rounded percentage */
function ratePct(rate: number): number {
  return Math.round(rate * 100)
}

function makeInsight(
  insightType: InsightType,
  message: string,
  priority: number,
  brands: readonly string[],
  region: string,
): AgentInsight {
  return {
    id: `delivery-intel-${insightType}-${region}-${brands.join(",") || "none"}`,
    agentId: "delivery-intel" as AgentId,
    insightType,
    message,
    timestamp: "static",
    priority,
    read: false,
    brands,
    region,
  }
}

// --- Insight generators ---

function findPlatformCoverageGaps(
  snapshot: DeliverySnapshot,
  brands: readonly string[],
): readonly AgentInsight[] {
  const insights: AgentInsight[] = []
  const platforms = ["deliveroo", "uberEats", "justEat"] as const

  for (const region of Object.keys(snapshot)) {
    // Keep only the single widest gap per platform in each region
    for (const platform of platforms) {
      const brandRates: { brand: string; rate: number }[] = []
      for (const brand of brands) {
        const stats = snapshot[region]?.[brand]
        if (!stats || stats.total < 5) continue
        brandRates.push({ brand, rate: stats[platform] / stats.total })
      }

      if (brandRates.length < 2) continue

      // Find the widest gap (max vs min) instead of all pairwise comparisons
      const sorted = [...brandRates].sort((a, b) => b.rate - a.rate)
      const high = sorted[0]
      const low = sorted[sorted.length - 1]
      const gap = high.rate - low.rate

      if (gap >= PLATFORM_GAP_PP / 100) {
        const platformName = platform === "uberEats" ? "Uber Eats"
          : platform === "justEat" ? "Just Eat"
          : "Deliveroo"
        insights.push(
          makeInsight(
            "platform-coverage-gap",
            `${ratePct(high.rate)}% of ${high.brand} in ${region} on ${platformName} vs ${ratePct(low.rate)}% of ${low.brand}`,
            2,
            [high.brand, low.brand],
            region,
          ),
        )
      }
    }
  }

  return insights
}

function findDeliveryDeserts(
  snapshot: DeliverySnapshot,
  brands: readonly string[],
): readonly AgentInsight[] {
  const insights: AgentInsight[] = []

  for (const region of Object.keys(snapshot)) {
    let totalPoints = 0
    let totalThirdParty = 0

    for (const brand of brands) {
      const stats = snapshot[region]?.[brand]
      if (!stats) continue
      totalPoints += stats.total
      totalThirdParty += stats.anyThirdParty
    }

    if (totalPoints >= 10) {
      const penetration = totalThirdParty / totalPoints
      if (penetration < DESERT_THRESHOLD) {
        insights.push(
          makeInsight(
            "delivery-desert",
            `${region}: only ${pct(totalThirdParty, totalPoints)}% third-party delivery coverage`,
            1,
            [],
            region,
          ),
        )
      }
    }
  }

  return insights
}

function findDriveThruAdvantages(
  snapshot: DeliverySnapshot,
  brands: readonly string[],
): readonly AgentInsight[] {
  const insights: AgentInsight[] = []

  for (const region of Object.keys(snapshot)) {
    const brandRates: { brand: string; rate: number }[] = []
    for (const brand of brands) {
      const stats = snapshot[region]?.[brand]
      if (!stats || stats.total < 5) continue
      brandRates.push({ brand, rate: stats.driveThru / stats.total })
    }

    if (brandRates.length < 2) continue

    // Keep only the widest gap per region
    const sorted = [...brandRates].sort((a, b) => b.rate - a.rate)
    const high = sorted[0]
    const low = sorted[sorted.length - 1]
    const gap = high.rate - low.rate

    if (gap >= DRIVE_THRU_GAP_PP / 100) {
      insights.push(
        makeInsight(
          "drive-thru-advantage",
          `${high.brand} has ${ratePct(high.rate)}% drive-thru in ${region} vs ${low.brand} ${ratePct(low.rate)}%`,
          3,
          [high.brand, low.brand],
          region,
        ),
      )
    }
  }

  return insights
}

function findOwnDeliveryDominance(
  snapshot: DeliverySnapshot,
  brands: readonly string[],
): readonly AgentInsight[] {
  const insights: AgentInsight[] = []

  for (const brand of brands) {
    const national = computeNationalStats(snapshot, brand)
    if (national.total < 10) continue

    const ownRate = national.ownDelivery / national.total
    const aggregatorRate = national.anyThirdParty / national.total

    if (ownRate > OWN_DELIVERY_HIGH && aggregatorRate < OWN_DELIVERY_NO_AGGREGATOR) {
      insights.push(
        makeInsight(
          "own-delivery-dominance",
          `${brand} relies on own delivery (${ratePct(ownRate)}%) — only ${ratePct(aggregatorRate)}% on third-party aggregators`,
          3,
          [brand],
          "National",
        ),
      )
    }
  }

  return insights
}

function findClickCollectLeaders(
  snapshot: DeliverySnapshot,
  brands: readonly string[],
): readonly AgentInsight[] {
  const insights: AgentInsight[] = []

  for (const region of Object.keys(snapshot)) {
    let leaderBrand = ""
    let leaderRate = 0

    for (const brand of brands) {
      const stats = snapshot[region]?.[brand]
      if (!stats || stats.total < 5) continue
      const rate = stats.clickAndCollect / stats.total
      if (rate > CLICK_COLLECT_LEADER && rate > leaderRate) {
        leaderRate = rate
        leaderBrand = brand
      }
    }

    if (leaderBrand) {
      const stats = snapshot[region]![leaderBrand]!
      insights.push(
        makeInsight(
          "click-collect-leader",
          `${leaderBrand} leads Click & Collect in ${region} at ${ratePct(leaderRate)}%`,
          4,
          [leaderBrand],
          region,
        ),
      )
    }
  }

  return insights
}

// --- Main runner ---

export function runDeliveryIntel(
  countryConfig: CountryConfig,
): readonly AgentInsight[] {
  const { brandPoints, brandAttributes, cityToRegion } = countryConfig
  if (!brandAttributes) return []

  const snapshot = buildDeliverySnapshot(brandPoints, brandAttributes, cityToRegion)
  const brands = Object.keys(countryConfig.brands)

  const insights: AgentInsight[] = [
    ...findPlatformCoverageGaps(snapshot, brands),
    ...findDeliveryDeserts(snapshot, brands),
    ...findDriveThruAdvantages(snapshot, brands),
    ...findOwnDeliveryDominance(snapshot, brands),
    ...findClickCollectLeaders(snapshot, brands),
  ]

  // Diversity-first cap: limit per insight type, then cap total
  const byType = new Map<string, AgentInsight[]>()
  for (const insight of insights) {
    const arr = byType.get(insight.insightType) || []
    byType.set(insight.insightType, [...arr, insight])
  }

  const diversified: AgentInsight[] = []
  for (const typeInsights of byType.values()) {
    diversified.push(...typeInsights.slice(0, MAX_PER_TYPE))
  }

  return [...diversified]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_DELIVERY_INSIGHTS)
}
