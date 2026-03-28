// Unified multi-anchor opportunity hook — merges stations + junctions + MSOA zones

import { useMemo, useState } from "react"
import { useCountry } from "@/contexts/CountryContext"
import type { OpportunityKpis, NarrativeSentence } from "@/lib/opportunity-scoring"
import { computeJunctionOpportunities } from "@/lib/junction-scoring"
import { computeMsoaOpportunities } from "@/lib/msoa-scoring"
import { toStationOpportunityV2 } from "@/lib/multi-anchor-types"
import type { Opportunity, AnchorType, StationOpportunityV2, JunctionOpportunity, MsoaOpportunity } from "@/lib/multi-anchor-types"
import type { BrandIntelligence } from "./useOpportunities"
import { useOpportunities } from "./useOpportunities"

export interface MultiAnchorResult {
  readonly opportunities: readonly Opportunity[]
  readonly stationOpps: readonly StationOpportunityV2[]
  readonly junctionOpps: readonly JunctionOpportunity[]
  readonly msoaOpps: readonly MsoaOpportunity[]
  readonly kpis: OpportunityKpis
  readonly narrative: readonly NarrativeSentence[]
  readonly brandIntelligence: BrandIntelligence | null
  readonly brandLabel: string
  readonly anchorFilter: AnchorType | "all"
  readonly setAnchorFilter: (filter: AnchorType | "all") => void
}

export function useMultiAnchorOpportunities(
  selectedBrands: ReadonlySet<string>,
): MultiAnchorResult {
  const { brands, brandPoints } = useCountry()
  const allBrands = useMemo(() => Object.keys(brands), [brands])
  const [anchorFilter, setAnchorFilter] = useState<AnchorType | "all">("all")

  // Station opportunities (reuse existing hook for narrative, KPIs, brand intel)
  const stationResult = useOpportunities(selectedBrands)

  const stationOpps = useMemo(
    () => stationResult.stations.map(toStationOpportunityV2),
    [stationResult.stations],
  )

  // Junction opportunities
  const allJunctions = useMemo(
    () => computeJunctionOpportunities(allBrands),
    [allBrands.join(",")],
  )

  const junctionOpps = useMemo(() => {
    if (selectedBrands.size === 0) return []
    return allJunctions
  }, [allJunctions, selectedBrands.size])

  // MSOA zone opportunities — computed once and memoized
  const msoaOpps = useMemo(() => {
    if (selectedBrands.size === 0) return []
    return computeMsoaOpportunities(allBrands, brandPoints)
  }, [allBrands.join(","), brandPoints, selectedBrands.size])

  // Junction narrative
  const junctionNarrative = useMemo((): readonly NarrativeSentence[] => {
    if (junctionOpps.length === 0) return []
    const actNow = junctionOpps.filter((j) => j.compositeScore >= 80).length
    const zeroDT = junctionOpps.filter((j) => j.driveThruCount === 0).length
    const topJunction = junctionOpps[0]
    const sentences: NarrativeSentence[] = []

    sentences.push({
      text: `Drive-thru analysis identified ${junctionOpps.length} high-traffic road segments (50K+ vehicles/day), with ${actNow} scoring 80+ for drive-thru potential.`,
    })

    if (zeroDT > 0) {
      sentences.push({
        text: `${zeroDT} road segments have zero drive-thru within 1.5km — first-mover corridor opportunities.`,
      })
    }

    if (topJunction) {
      sentences.push({
        text: `Top junction: ${topJunction.trafficPoint.roadName} (${Math.round(topJunction.trafficPoint.aadf / 1000)}K vehicles/day) in ${topJunction.region}, score ${topJunction.compositeScore}/100.`,
      })
    }

    return sentences
  }, [junctionOpps])

  // MSOA narrative
  const msoaNarrative = useMemo((): readonly NarrativeSentence[] => {
    if (msoaOpps.length === 0) return []
    const highScore = msoaOpps.filter((m) => m.compositeScore >= 60).length
    const topZone = msoaOpps[0]
    const sentences: NarrativeSentence[] = []

    sentences.push({
      text: `Area analysis found ${msoaOpps.length} MSOA zones with expansion potential, ${highScore} scoring 60+.`,
    })

    if (topZone) {
      sentences.push({
        text: `Top zone: ${topZone.label} (${Math.round(topZone.analysis.workplacePop / 1000)}K workers, ${topZone.brandGaps.length} brand gaps), score ${topZone.compositeScore}/100.`,
      })
    }

    return sentences
  }, [msoaOpps])

  // Compose narratives
  const narrative = useMemo(
    () => [...stationResult.narrative, ...junctionNarrative, ...msoaNarrative],
    [stationResult.narrative, junctionNarrative, msoaNarrative],
  )

  // Merge and re-rank all opportunities
  const opportunities = useMemo(() => {
    let merged: Opportunity[] = []

    if (anchorFilter === "all" || anchorFilter === "station") {
      merged = [...merged, ...stationOpps]
    }
    if (anchorFilter === "all" || anchorFilter === "junction") {
      merged = [...merged, ...junctionOpps]
    }
    if (anchorFilter === "all" || anchorFilter === "msoa") {
      merged = [...merged, ...msoaOpps]
    }

    merged.sort((a, b) => b.compositeScore - a.compositeScore)
    return merged.map((opp, i) => ({ ...opp, rank: i + 1 }))
  }, [stationOpps, junctionOpps, msoaOpps, anchorFilter])

  return {
    opportunities,
    stationOpps,
    junctionOpps,
    msoaOpps,
    kpis: stationResult.kpis,
    narrative,
    brandIntelligence: stationResult.brandIntelligence,
    brandLabel: stationResult.brandLabel,
    anchorFilter,
    setAnchorFilter,
  }
}
