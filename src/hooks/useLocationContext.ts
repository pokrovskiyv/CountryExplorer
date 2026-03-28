// Computes enrichment data for a clicked map location (MSOA or restaurant)
// Uses in-memory data only — no async, no new computation pipelines

import { useMemo } from "react"
import { useCountry } from "@/contexts/CountryContext"
import { STATION_DATA } from "@/data/station-data"
import { haversineDistance, countPointsInRadius, formatDistance } from "@/lib/geo-utils"
import { computeStationOpportunities } from "@/lib/opportunity-scoring"
import type { StationOpportunity } from "@/lib/opportunity-scoring"

const NEARBY_RADIUS_KM = 1.0

export interface BrandPresence {
  readonly brand: string
  readonly count: number
  readonly color: string
}

export interface NearestStationInfo {
  readonly name: string
  readonly distance: number
  readonly distanceLabel: string
  readonly annualEntries: number
  readonly footfallLabel: string
  readonly opportunityScore: number | null
  readonly confidence: string | null
}

export interface LocationContext {
  readonly nearbyBrands: readonly BrandPresence[]
  readonly totalNearby: number
  readonly brandGaps: readonly string[]
  readonly nearestStation: NearestStationInfo | null
  readonly insight: string
}

// Cache station opportunities across calls
let cachedOpportunities: readonly StationOpportunity[] | null = null
let cachedBrandKeys: string | null = null

function getStationOpportunities(brandKeys: readonly string[]): readonly StationOpportunity[] {
  const key = brandKeys.join(",")
  if (cachedOpportunities && cachedBrandKeys === key) return cachedOpportunities
  cachedOpportunities = computeStationOpportunities(brandKeys)
  cachedBrandKeys = key
  return cachedOpportunities
}

function formatFootfall(annual: number): string {
  if (annual >= 1_000_000) return `${(annual / 1_000_000).toFixed(1)}M/year`
  if (annual >= 1_000) return `${Math.round(annual / 1_000)}K/year`
  return `${annual}/year`
}

function findNearestStation(lat: number, lon: number, brandKeys: readonly string[]): NearestStationInfo | null {
  if (STATION_DATA.length === 0) return null

  let bestIdx = -1
  let bestDist = Infinity

  for (let i = 0; i < STATION_DATA.length; i++) {
    const s = STATION_DATA[i]
    const dist = haversineDistance(lat, lon, s.lat, s.lon)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }

  if (bestIdx < 0 || bestDist > 10) return null // > 10km = no relevant station

  const station = STATION_DATA[bestIdx]
  const opportunities = getStationOpportunities(brandKeys)
  const opp = opportunities.find((o) => o.station.name === station.name)

  return {
    name: station.name,
    distance: bestDist,
    distanceLabel: formatDistance(bestDist),
    annualEntries: station.annualEntries,
    footfallLabel: formatFootfall(station.annualEntries),
    opportunityScore: opp?.compositeScore ?? null,
    confidence: opp?.confidence ?? null,
  }
}

function generateInsight(
  nearbyBrands: readonly BrandPresence[],
  brandGaps: readonly string[],
  totalNearby: number,
  nearestStation: NearestStationInfo | null,
  deprivationDecile: number | null,
): string {
  const parts: string[] = []

  // Competition assessment
  if (totalNearby === 0) {
    parts.push("No fast food within 1km")
  } else if (totalNearby <= 2) {
    parts.push("Low competition")
  } else if (totalNearby <= 5) {
    parts.push("Moderate competition")
  } else {
    parts.push("Dense competition")
  }

  // Demographic context
  if (deprivationDecile !== null) {
    if (deprivationDecile <= 3) {
      parts.push("affluent area")
    } else if (deprivationDecile <= 7) {
      parts.push("moderate income area")
    } else {
      parts.push("high deprivation area")
    }
  }

  let sentence = parts.length > 0
    ? parts[0] + (parts.length > 1 ? ", " + parts.slice(1).join(", ") : "") + "."
    : ""

  // Footfall context
  if (nearestStation && nearestStation.distance <= 2) {
    const footfallLevel = nearestStation.annualEntries >= 5_000_000 ? "high" :
      nearestStation.annualEntries >= 1_000_000 ? "decent" : "modest"
    sentence += ` ${footfallLevel[0].toUpperCase() + footfallLevel.slice(1)} footfall from ${nearestStation.name} (${nearestStation.distanceLabel}).`
  }

  // Brand gaps
  if (brandGaps.length > 0 && brandGaps.length <= 3) {
    sentence += ` ${brandGaps.join(" and ")} missing — potential opportunity.`
  } else if (brandGaps.length > 3) {
    sentence += ` ${brandGaps.length} selected brands missing — underserved area.`
  }

  return sentence.trim()
}

export function useLocationContext(
  lat: number | null,
  lon: number | null,
  selectedBrands: ReadonlySet<string>,
  deprivationDecile: number | null,
): LocationContext | null {
  const { brands: BRANDS, brandPoints: BRAND_POINTS } = useCountry()
  const brandKeys = useMemo(() => [...selectedBrands].sort(), [selectedBrands])

  return useMemo(() => {
    if (lat === null || lon === null) return null

    // Count nearby restaurants per brand
    const nearbyBrands: BrandPresence[] = []
    let totalNearby = 0

    for (const brand of brandKeys) {
      const points = BRAND_POINTS[brand]
      if (!points) continue
      const count = countPointsInRadius(lat, lon, points, NEARBY_RADIUS_KM)
      nearbyBrands.push({
        brand,
        count,
        color: BRANDS[brand]?.color ?? "#6b7280",
      })
      totalNearby += count
    }

    nearbyBrands.sort((a, b) => b.count - a.count)

    const brandGaps = nearbyBrands
      .filter((b) => b.count === 0)
      .map((b) => b.brand)

    const nearestStation = findNearestStation(lat, lon, brandKeys)

    const insight = generateInsight(nearbyBrands, brandGaps, totalNearby, nearestStation, deprivationDecile)

    return { nearbyBrands, totalNearby, brandGaps, nearestStation, insight }
  }, [lat, lon, brandKeys, deprivationDecile, BRAND_POINTS, BRANDS])
}
