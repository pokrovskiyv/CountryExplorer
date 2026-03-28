// Junction Opportunity Scoring — drive-thru focused analysis for high-traffic road segments
// 4-signal weighted model using DfT AADF traffic data

import { TRAFFIC_DATA, type TrafficPoint } from "@/data/traffic-data"
import { REGION_DEMOGRAPHICS } from "@/data/demographic-data"
import type { ConfidenceLevel } from "./opportunity-scoring"
import { BRAND_INCOME_AFFINITY, AFFINITY_DECILE_RANGES } from "./opportunity-scoring"
import type { JunctionOpportunity, JunctionSignalProfile, JunctionAnalysis } from "./multi-anchor-types"

// --- Signal weights ---

const SIGNAL_WEIGHTS = {
  trafficVolume: 35,
  driveThruGap: 35,
  qsrPresence: 15,
  demographicFit: 15,
}

const MIN_AADF = 50_000
const MIN_SIGNALS = 2
const LOG_MIN = Math.log(MIN_AADF)
const LOG_MAX = Math.log(
  TRAFFIC_DATA.reduce((max, t) => Math.max(max, t.aadf), 0) || MIN_AADF,
)

// --- Percentile computation ---

const sortedAadf = [...TRAFFIC_DATA].map((t) => t.aadf).sort((a, b) => a - b)

function aadfPercentile(aadf: number): number {
  const idx = sortedAadf.findIndex((v) => v >= aadf)
  return idx < 0 ? 100 : Math.round((idx / sortedAadf.length) * 100)
}

// --- Signal evaluators ---

function evalTrafficVolume(tp: TrafficPoint): { strength: number; fired: boolean } {
  if (tp.aadf < MIN_AADF) return { strength: 0, fired: false }
  const logVal = Math.log(Math.max(tp.aadf, MIN_AADF))
  const strength = Math.min(0.9, 0.3 + ((logVal - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 0.6)
  return { strength, fired: true }
}

function evalDriveThruGap(tp: TrafficPoint): { strength: number; fired: boolean } {
  if (tp.driveThruCount1500m >= 2) return { strength: 0, fired: false }
  const strength = tp.driveThruCount1500m === 0 ? 0.9 : 0.5
  return { strength, fired: true }
}

function evalQsrPresence(tp: TrafficPoint): { strength: number; fired: boolean } {
  if (tp.qsrCount1500m === 0) return { strength: 0, fired: false }
  const strength = Math.min(0.7, 0.4 + tp.qsrCount1500m * 0.1)
  return { strength, fired: true }
}

function evalDemographicFit(tp: TrafficPoint, brand: string): { strength: number; fired: boolean } {
  const demo = REGION_DEMOGRAPHICS.find((d) => d.region === tp.region)
  if (!demo) return { strength: 0, fired: false }

  const affinity = BRAND_INCOME_AFFINITY[brand] ?? "neutral"
  const range = AFFINITY_DECILE_RANGES[affinity]
  const decile = demo.medianIncomeDecile ?? 5

  if (decile >= range.min && decile <= range.max) {
    return { strength: 0.6, fired: true }
  }
  return { strength: 0, fired: false }
}

// --- Scoring ---

function computeJunctionScore(
  tp: TrafficPoint,
  allBrands: readonly string[],
): { score: number; signalCount: number; profile: JunctionSignalProfile; confidence: ConfidenceLevel } {
  const tv = evalTrafficVolume(tp)
  const dtg = evalDriveThruGap(tp)
  const qsr = evalQsrPresence(tp)

  // Demographic: check at least one brand fits the region's demographics
  let bestDemo = { strength: 0, fired: false }
  for (const brand of allBrands) {
    const d = evalDemographicFit(tp, brand)
    if (d.strength > bestDemo.strength) bestDemo = d
  }

  const signals = [
    { weight: SIGNAL_WEIGHTS.trafficVolume, ...tv },
    { weight: SIGNAL_WEIGHTS.driveThruGap, ...dtg },
    { weight: SIGNAL_WEIGHTS.qsrPresence, ...qsr },
    { weight: SIGNAL_WEIGHTS.demographicFit, ...bestDemo },
  ]

  const firedCount = signals.filter((s) => s.fired).length
  if (firedCount < MIN_SIGNALS) {
    return {
      score: 0,
      signalCount: 0,
      profile: { trafficVolume: 0, driveThruGap: 0, qsrPresence: 0, demographicFit: 0 },
      confidence: "low",
    }
  }

  const raw = signals.reduce((sum, s) => sum + (s.fired ? s.weight * s.strength : 0), 0)
  const confidenceBonus = firedCount >= 4 ? 1.15 : firedCount >= 3 ? 1.05 : 1.0
  const score = Math.round(Math.min(100, raw * confidenceBonus))

  const confidence: ConfidenceLevel = firedCount >= 4 ? "high" : firedCount >= 3 ? "medium" : "low"

  return {
    score,
    signalCount: firedCount,
    profile: {
      trafficVolume: tv.fired ? Math.round(tv.strength * 100) : 0,
      driveThruGap: dtg.fired ? Math.round(dtg.strength * 100) : 0,
      qsrPresence: qsr.fired ? Math.round(qsr.strength * 100) : 0,
      demographicFit: bestDemo.fired ? Math.round(bestDemo.strength * 100) : 0,
    },
    confidence,
  }
}

function analyzeJunction(tp: TrafficPoint, score: number): JunctionAnalysis {
  const demandEvidence: string[] = []
  const riskFactors: string[] = []

  demandEvidence.push(`${tp.roadName} carries ${Math.round(tp.aadf / 1000)}K vehicles/day (DfT AADF)`)

  if (tp.driveThruCount1500m === 0) {
    demandEvidence.push(`Zero drive-thru within 1.5km — first-mover opportunity`)
  } else if (tp.driveThruCount1500m === 1) {
    demandEvidence.push(`Only 1 drive-thru within 1.5km — limited competition`)
  }

  if (tp.qsrCount1500m >= 3) {
    demandEvidence.push(`${tp.qsrCount1500m} QSR within 1.5km — validated commercial demand`)
  }

  if (tp.aadf > 150_000) {
    riskFactors.push(`Ultra-high traffic volume may indicate motorway with limited access/egress`)
  }

  if (tp.qsrCount1500m === 0) {
    riskFactors.push(`No existing QSR nearby — location may lack roadside commercial infrastructure`)
  }

  const driveThruSaturation: JunctionAnalysis["driveThruSaturation"] =
    tp.driveThruCount1500m === 0 ? "none" : tp.driveThruCount1500m < 2 ? "low" : "saturated"

  return {
    aadPercentile: aadfPercentile(tp.aadf),
    driveThruSaturation,
    demandEvidence,
    riskFactors,
  }
}

// --- Public API ---

export function computeJunctionOpportunities(
  allBrands: readonly string[],
): readonly JunctionOpportunity[] {
  const scored: JunctionOpportunity[] = []

  for (const tp of TRAFFIC_DATA) {
    const { score, signalCount, profile, confidence } = computeJunctionScore(tp, allBrands)
    if (score === 0) continue

    scored.push({
      id: `junction:${tp.lat.toFixed(4)}_${tp.lon.toFixed(4)}`,
      anchorType: "junction",
      rank: 0, // will be set after sorting
      compositeScore: score,
      confidence,
      signalCount,
      lat: tp.lat,
      lng: tp.lon,
      region: tp.region,
      label: `${tp.roadName} (${Math.round(tp.aadf / 1000)}K/day)`,
      trafficPoint: tp,
      signalProfile: profile,
      analysis: analyzeJunction(tp, score),
      driveThruCount: tp.driveThruCount1500m,
      qsrCount: tp.qsrCount1500m,
    })
  }

  scored.sort((a, b) => b.compositeScore - a.compositeScore)
  return scored.map((opp, i) => ({ ...opp, rank: i + 1 }))
}

export function fmtJunctionAadf(aadf: number): string {
  return aadf >= 1_000_000
    ? `${(aadf / 1_000_000).toFixed(1)}M`
    : `${Math.round(aadf / 1000)}K`
}
