// Data hook for Brand Dossier page
// Computes all data needed for a single-brand intelligence report:
// top 10 stations, competitor landscape, region affinity matrix

import { useMemo } from "react"
import { useCountry } from "@/contexts/CountryContext"
import {
  computeStationOpportunities,
  generateNarrative,
  BRAND_INCOME_AFFINITY,
  AFFINITY_DECILE_RANGES,
  fmt,
  type StationOpportunity,
  type IncomeAffinity,
  type ActionTier,
  type NarrativeSentence,
  type Signal,
} from "@/lib/opportunity-scoring"
import { AI_STATION_ANALYSIS, AI_EXECUTIVE_SUMMARY } from "@/data/ai-opportunity-analysis"
import { REGION_DEMOGRAPHICS } from "@/data/demographic-data"

// --- Types ---

const DOSSIER_TOP_COUNT = 10

export interface EnrichedTopStation {
  readonly rank: number
  readonly stationName: string
  readonly region: string
  readonly score: number
  readonly confidence: "high" | "medium" | "low"
  readonly signalCount: number
  readonly annualPassengers: number
  readonly busStops: number
  readonly qsrCount: number
  readonly nearestRoad: { name: string; aadf: number; distance: number } | null
  readonly signals: readonly Signal[]
  readonly actionTier: ActionTier | null
  readonly brandRecommendation: string
  readonly whyThisStation: string
  readonly riskMitigation: string
}

export interface RegionAffinityRow {
  readonly region: string
  readonly medianIncomeDecile: number
  readonly isInSweetSpot: boolean
  readonly stationCount: number
}

export interface CompetitorRow {
  readonly brand: string
  readonly brandColor: string
  readonly overlapCount: number
  readonly overlapPercent: number
}

export interface BrandDossierData {
  readonly brand: string
  readonly brandColor: string
  readonly brandIcon: string
  readonly affinity: IncomeAffinity
  readonly idealDecileRange: string
  readonly stationCount: number
  readonly avgBrandScore: number
  readonly affinityMatchRate: number
  readonly strategicThesis: string
  readonly topStations: readonly EnrichedTopStation[]
  readonly regionAffinityData: readonly RegionAffinityRow[]
  readonly competitorLandscape: readonly CompetitorRow[]
  readonly topCompetitor: { readonly brand: string; readonly overlapCount: number } | null
  readonly narrative: readonly NarrativeSentence[]
}

// --- Computation ---

function computeDossierData(
  brand: string,
  brandColor: string,
  brandIcon: string,
  allBrands: readonly string[],
  brandColors: Record<string, string>,
  allStations: readonly StationOpportunity[],
): BrandDossierData {
  const affinity = BRAND_INCOME_AFFINITY[brand] ?? "neutral"
  const range = AFFINITY_DECILE_RANGES[affinity]
  const brandSet = new Set([brand])

  // Filter and rank for this brand only
  const stations = allStations
    .map((opp) => {
      const gap = opp.brandGaps.find((bg) => bg.brand === brand)
      if (!gap) return null
      const firedCount = gap.signals.filter((s) => s.fired).length
      return {
        ...opp,
        brandGaps: [gap],
        compositeScore: gap.score,
        signalCount: firedCount,
        confidence: (firedCount >= 4 ? "high" : firedCount >= 3 ? "medium" : "low") as const,
      }
    })
    .filter((opp): opp is StationOpportunity => opp !== null)
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .map((opp, i) => ({ ...opp, rank: i + 1 }))

  // Enriched top 10
  const topStations: EnrichedTopStation[] = stations.slice(0, DOSSIER_TOP_COUNT).map((opp, i) => {
    const ai = AI_STATION_ANALYSIS[opp.station.name]
    const gap = opp.brandGaps[0]
    return {
      rank: i + 1,
      stationName: opp.station.name,
      region: opp.station.region,
      score: opp.compositeScore,
      confidence: opp.confidence,
      signalCount: opp.signalCount,
      annualPassengers: opp.station.annualEntries,
      busStops: opp.station.busStopCount800m ?? 0,
      qsrCount: opp.station.qsrCount800m,
      nearestRoad: opp.nearestRoad,
      signals: gap?.signals ?? [],
      actionTier: ai?.actionTier ?? null,
      brandRecommendation: ai?.brandRecommendations[brand] ?? ai?.recommendation ?? "",
      whyThisStation: ai?.whyThisStation ?? "",
      riskMitigation: ai?.riskMitigation ?? "",
    }
  })

  // Avg score
  const avgBrandScore =
    stations.length > 0
      ? Math.round(stations.reduce((sum, s) => sum + s.compositeScore, 0) / stations.length)
      : 0

  // Income affinity match rate
  const demoLookup = new Map(REGION_DEMOGRAPHICS.map((d) => [d.region, d]))
  let matchCount = 0
  for (const opp of stations) {
    const demo = demoLookup.get(opp.station.region)
    if (demo && demo.medianIncomeDecile >= range.min && demo.medianIncomeDecile <= range.max) {
      matchCount++
    }
  }
  const affinityMatchRate = stations.length > 0 ? Math.round((matchCount / stations.length) * 100) : 0

  // Region affinity matrix
  const regionStationCounts = new Map<string, number>()
  for (const opp of stations) {
    const r = opp.station.region
    regionStationCounts.set(r, (regionStationCounts.get(r) ?? 0) + 1)
  }
  const regionAffinityData: RegionAffinityRow[] = REGION_DEMOGRAPHICS.map((d) => ({
    region: d.region,
    medianIncomeDecile: d.medianIncomeDecile,
    isInSweetSpot: d.medianIncomeDecile >= range.min && d.medianIncomeDecile <= range.max,
    stationCount: regionStationCounts.get(d.region) ?? 0,
  })).sort((a, b) => b.stationCount - a.stationCount)

  // Competitor landscape (all brands, ranked by overlap)
  const competitorCounts = new Map<string, number>()
  for (const opp of stations) {
    for (const pb of opp.presentBrands) {
      if (pb.brand !== brand) {
        competitorCounts.set(pb.brand, (competitorCounts.get(pb.brand) ?? 0) + 1)
      }
    }
  }
  const competitorLandscape: CompetitorRow[] = [...competitorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([b, count]) => ({
      brand: b,
      brandColor: brandColors[b] ?? "#888",
      overlapCount: count,
      overlapPercent: stations.length > 0 ? Math.round((count / stations.length) * 100) : 0,
    }))

  const topCompetitor = competitorLandscape[0]
    ? { brand: competitorLandscape[0].brand, overlapCount: competitorLandscape[0].overlapCount }
    : null

  // Strategic thesis
  const thesisParts: string[] = []
  thesisParts.push(
    `${brand} has ${stations.length} whitespace station locations across the UK where the brand is absent but competitors validate demand.`,
  )
  if (topCompetitor) {
    thesisParts.push(
      `${topCompetitor.brand} is already present at ${topCompetitor.overlapCount} of these ${stations.length} stations (${competitorLandscape[0]?.overlapPercent}%), confirming commercial viability.`,
    )
  }
  thesisParts.push(
    `${affinityMatchRate}% of opportunities fall in ${brand}'s income sweet spot (Deciles ${range.label}), indicating strong demographic alignment.`,
  )
  if (topStations[0]) {
    thesisParts.push(
      `The highest-scoring opportunity is ${topStations[0].stationName} (Score ${topStations[0].score}/100) with ${fmt(topStations[0].annualPassengers)} passengers/year.`,
    )
  }
  const strategicThesis = thesisParts.join(" ")

  // Narrative
  const narrative = generateNarrative(stations, brand)

  return {
    brand,
    brandColor,
    brandIcon,
    affinity,
    idealDecileRange: range.label,
    stationCount: stations.length,
    avgBrandScore,
    affinityMatchRate,
    strategicThesis,
    topStations,
    regionAffinityData,
    competitorLandscape,
    topCompetitor,
    narrative,
  }
}

// --- Hook ---

export function useBrandDossier(brandKey: string): BrandDossierData | null {
  const { brands } = useCountry()
  const allBrands = useMemo(() => Object.keys(brands), [brands])
  const brandInfo = brands[brandKey]

  const allStations = useMemo(
    () => computeStationOpportunities(allBrands),
    [allBrands],
  )

  const brandColors = useMemo(
    () => Object.fromEntries(Object.entries(brands).map(([k, v]) => [k, v.color])),
    [brands],
  )

  const dossier = useMemo(() => {
    if (!brandInfo) return null
    return computeDossierData(
      brandKey,
      brandInfo.color,
      brandInfo.icon ?? "",
      allBrands,
      brandColors,
      allStations,
    )
  }, [brandKey, brandInfo, allBrands, brandColors, allStations])

  return dossier
}
