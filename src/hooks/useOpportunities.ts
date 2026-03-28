// Hook wrapping opportunity scoring engine with memoization and brand filtering
// Returns station-centric opportunities, KPIs, narrative, and per-brand intelligence

import { useMemo } from "react"
import { useCountry } from "@/contexts/CountryContext"
import {
  computeStationOpportunities,
  computeKpis,
  generateNarrative,
  BRAND_INCOME_AFFINITY,
  AFFINITY_DECILE_RANGES,
  type StationOpportunity,
  type OpportunityKpis,
  type NarrativeSentence,
  type IncomeAffinity,
  type ActionTier,
} from "@/lib/opportunity-scoring"
import { AI_STATION_ANALYSIS } from "@/data/ai-opportunity-analysis"
import { REGION_DEMOGRAPHICS } from "@/data/demographic-data"

// --- Brand Intelligence (computed when exactly 1 brand selected) ---

export interface BrandTopStation {
  readonly stationName: string
  readonly score: number
  readonly recommendation: string
  readonly actionTier: ActionTier | null
  readonly region: string
}

export interface BrandIntelligence {
  readonly brand: string
  readonly affinity: IncomeAffinity
  readonly idealDecileRange: string
  readonly stationCount: number
  readonly avgBrandScore: number
  readonly topStations: readonly BrandTopStation[]
  readonly affinityMatchRate: number
  readonly topCompetitor: { readonly brand: string; readonly overlapCount: number } | null
}

const TOP_STATIONS_COUNT = 5

function computeBrandIntelligence(
  brand: string,
  stations: readonly StationOpportunity[],
): BrandIntelligence {
  const affinity = BRAND_INCOME_AFFINITY[brand] ?? "neutral"
  const range = AFFINITY_DECILE_RANGES[affinity]

  // Top 5 stations with AI recommendations
  const topStations: BrandTopStation[] = stations.slice(0, TOP_STATIONS_COUNT).map((opp) => {
    const ai = AI_STATION_ANALYSIS[opp.station.name]
    return {
      stationName: opp.station.name,
      score: opp.compositeScore,
      recommendation: ai?.brandRecommendations[brand] ?? ai?.recommendation ?? "",
      actionTier: ai?.actionTier ?? null,
      region: opp.station.region,
    }
  })

  // Avg score
  const avgBrandScore =
    stations.length > 0
      ? Math.round(stations.reduce((sum, s) => sum + s.compositeScore, 0) / stations.length)
      : 0

  // Affinity match rate: % of stations in regions matching brand's income sweet spot
  const demoLookup = new Map(REGION_DEMOGRAPHICS.map((d) => [d.region, d]))
  let matchCount = 0
  for (const opp of stations) {
    const demo = demoLookup.get(opp.station.region)
    if (demo && demo.medianIncomeDecile >= range.min && demo.medianIncomeDecile <= range.max) {
      matchCount++
    }
  }
  const affinityMatchRate = stations.length > 0 ? Math.round((matchCount / stations.length) * 100) : 0

  // Top competitor: which brand appears most at our gap stations
  const competitorCounts = new Map<string, number>()
  for (const opp of stations) {
    for (const pb of opp.presentBrands) {
      if (pb.brand !== brand) {
        competitorCounts.set(pb.brand, (competitorCounts.get(pb.brand) ?? 0) + 1)
      }
    }
  }
  let topCompetitor: BrandIntelligence["topCompetitor"] = null
  let maxOverlap = 0
  for (const [b, count] of competitorCounts) {
    if (count > maxOverlap) {
      maxOverlap = count
      topCompetitor = { brand: b, overlapCount: count }
    }
  }

  return {
    brand,
    affinity,
    idealDecileRange: range.label,
    stationCount: stations.length,
    avgBrandScore,
    topStations,
    affinityMatchRate,
    topCompetitor,
  }
}

// --- Main hook ---

export interface OpportunitiesResult {
  readonly stations: readonly StationOpportunity[]
  readonly kpis: OpportunityKpis
  readonly narrative: readonly NarrativeSentence[]
  readonly brandIntelligence: BrandIntelligence | null
  readonly brandLabel: string
}

export function useOpportunities(
  selectedBrands: ReadonlySet<string>,
): OpportunitiesResult {
  const { brands } = useCountry()
  const allBrands = useMemo(() => Object.keys(brands), [brands])

  // Compute all station opportunities once (expensive, memo'd on allBrands)
  const allStations = useMemo(
    () => computeStationOpportunities(allBrands),
    [allBrands],
  )

  // Filter by selected brands and re-rank
  const stations = useMemo(() => {
    const filtered = allStations
      .map((opp) => {
        const relevantGaps = opp.brandGaps.filter((bg) =>
          selectedBrands.has(bg.brand),
        )
        if (relevantGaps.length === 0) return null

        const bestScore = relevantGaps[0].score
        const bestSignals = relevantGaps[0].signals.filter((s) => s.fired).length

        return {
          ...opp,
          brandGaps: relevantGaps,
          compositeScore: bestScore,
          signalCount: bestSignals,
          confidence: (bestSignals >= 4 ? "high" : bestSignals >= 3 ? "medium" : "low") as const,
        }
      })
      .filter((opp): opp is StationOpportunity => opp !== null)
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .map((opp, i) => ({ ...opp, rank: i + 1 }))

    return filtered
  }, [allStations, selectedBrands])

  // Brand label for narrative
  const brandLabel = useMemo(() => {
    if (selectedBrands.size === allBrands.length) return "All Brands"
    return [...selectedBrands].join(", ")
  }, [selectedBrands, allBrands.length])

  const kpis = useMemo(() => computeKpis(stations), [stations])
  const narrative = useMemo(
    () => generateNarrative(stations, brandLabel),
    [stations, brandLabel],
  )

  // Brand intelligence: only when exactly 1 brand selected
  const brandIntelligence = useMemo(() => {
    if (selectedBrands.size !== 1) return null
    const brand = [...selectedBrands][0]
    return computeBrandIntelligence(brand, stations)
  }, [selectedBrands, stations])

  return { stations, kpis, narrative, brandIntelligence, brandLabel }
}
