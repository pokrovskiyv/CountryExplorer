// Multi-Anchor Opportunity Types — unified type system for stations, junctions, and MSOA zones
// Each anchor type produces a 0-100 composite score for cross-type ranking

import type { ConfidenceLevel, BrandGap, StationAnalysis, SignalProfile, StationOpportunity } from "./opportunity-scoring"
import type { StationRecord } from "@/data/station-data"
import type { TrafficPoint } from "@/data/traffic-data"

export type AnchorType = "station" | "junction" | "msoa"

export interface OpportunityBase {
  readonly id: string
  readonly anchorType: AnchorType
  readonly rank: number
  readonly compositeScore: number
  readonly confidence: ConfidenceLevel
  readonly signalCount: number
  readonly lat: number
  readonly lng: number
  readonly region: string
  readonly label: string
}

// Station opportunity — wraps existing StationOpportunity
export interface StationOpportunityV2 extends OpportunityBase {
  readonly anchorType: "station"
  readonly station: StationRecord
  readonly nearestRoad: { name: string; aadf: number; distance: number } | null
  readonly signalProfile: SignalProfile
  readonly analysis: StationAnalysis
  readonly brandGaps: readonly BrandGap[]
  readonly presentBrands: readonly { brand: string; count: number }[]
}

// Junction opportunity — drive-thru focused
export interface JunctionSignalProfile {
  readonly trafficVolume: number
  readonly driveThruGap: number
  readonly qsrPresence: number
  readonly demographicFit: number
}

export interface JunctionAnalysis {
  readonly aadPercentile: number
  readonly driveThruSaturation: "none" | "low" | "saturated"
  readonly demandEvidence: readonly string[]
  readonly riskFactors: readonly string[]
}

export interface JunctionOpportunity extends OpportunityBase {
  readonly anchorType: "junction"
  readonly trafficPoint: TrafficPoint
  readonly signalProfile: JunctionSignalProfile
  readonly analysis: JunctionAnalysis
  readonly driveThruCount: number
  readonly qsrCount: number
}

// MSOA zone opportunity — area-level analysis
export interface MsoaSignalProfile {
  readonly brandGap: number
  readonly qsrDensityGap: number
  readonly demographicFit: number
  readonly workforceDensity: number
  readonly footfallProximity: number
}

export interface MsoaAnalysis {
  readonly deprivationDecile: number
  readonly workplacePop: number
  readonly nearestStation: { name: string; distance: number; footfall: number } | null
  readonly demandEvidence: readonly string[]
  readonly riskFactors: readonly string[]
}

export interface MsoaOpportunity extends OpportunityBase {
  readonly anchorType: "msoa"
  readonly msoaCode: string
  readonly signalProfile: MsoaSignalProfile
  readonly analysis: MsoaAnalysis
  readonly brandGaps: readonly string[]
  readonly qsrCount: number
}

export type Opportunity = StationOpportunityV2 | JunctionOpportunity | MsoaOpportunity

/** Wrap existing StationOpportunity into unified type */
export function toStationOpportunityV2(opp: StationOpportunity): StationOpportunityV2 {
  return {
    id: `station:${opp.station.name}`,
    anchorType: "station",
    rank: opp.rank,
    compositeScore: opp.compositeScore,
    confidence: opp.confidence,
    signalCount: opp.signalCount,
    lat: opp.station.lat,
    lng: opp.station.lon,
    region: opp.station.region,
    label: opp.station.name,
    station: opp.station,
    nearestRoad: opp.nearestRoad,
    signalProfile: opp.signalProfile,
    analysis: opp.analysis,
    brandGaps: opp.brandGaps,
    presentBrands: opp.presentBrands,
  }
}
