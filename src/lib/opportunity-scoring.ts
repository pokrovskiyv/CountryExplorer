// Opportunity Scoring Engine — single source of truth for station-centric analysis
// Replaces duplicated scoring in OpportunitiesView.tsx and opportunity-engine-agent.ts
// Weighted 7-signal formula with per-station deep analysis and cited evidence

import { STATION_DATA, type StationRecord } from "@/data/station-data"
import { REGION_DEMOGRAPHICS } from "@/data/demographic-data"
import { TRAFFIC_DATA, type TrafficPoint } from "@/data/traffic-data"
import { haversineDistance } from "./geo-utils"

// --- Types ---

export type IncomeAffinity = "premium" | "value" | "neutral"

export type SourceType = "gov" | "getplace" | "derived"

export type ConfidenceLevel = "high" | "medium" | "low"

export interface CitedFact {
  readonly text: string
  readonly source: string
  readonly sourceType: SourceType
  readonly verifiable: boolean
}

export interface Signal {
  readonly name: string
  readonly weight: number
  readonly strength: number
  readonly source: string
  readonly rawValue: string
  readonly fired: boolean
}

export interface SignalProfile {
  readonly footfall: number
  readonly brandGap: number
  readonly demographic: number
  readonly density: number
  readonly pedestrian: number
  readonly roadTraffic: number
  readonly workforceDensity: number
}

export interface StationAnalysis {
  readonly footfallPercentile: number
  readonly qsrDensityPercentile: number
  readonly pedestrianPercentile: number
  readonly demandEvidence: readonly CitedFact[]
  readonly supplyGapEvidence: readonly CitedFact[]
  readonly riskFactors: readonly CitedFact[]
  readonly dataCompleteness: number
  readonly missingDataNotes: readonly string[]
}

export interface BrandGap {
  readonly brand: string
  readonly score: number
  readonly signals: readonly Signal[]
  readonly affinity: IncomeAffinity
}

export interface StationOpportunity {
  readonly rank: number
  readonly station: StationRecord
  readonly compositeScore: number
  readonly confidence: ConfidenceLevel
  readonly signalCount: number
  readonly brandGaps: readonly BrandGap[]
  readonly presentBrands: readonly { brand: string; count: number }[]
  readonly nearestRoad: { name: string; aadf: number; distance: number } | null
  readonly signalProfile: SignalProfile
  readonly analysis: StationAnalysis
}

// --- AI Analysis types (populated by /analyze-opportunities skill) ---

export type ActionTier = "act-now" | "evaluate" | "monitor"

export interface StationAIAnalysis {
  readonly actionTier: ActionTier
  readonly recommendation: string
  readonly whyThisStation: string
  readonly brandRecommendations: Readonly<Record<string, string>>
  readonly riskMitigation: string
}

export interface AIExecutiveSummary {
  readonly overview: string
  readonly topPicks: string
  readonly brandStrategy: string
  readonly geographicClusters: string
  readonly driveThruOpportunities: string
}

export interface NarrativeSentence {
  readonly text: string
  readonly sources: readonly string[]
}

export interface OpportunityKpis {
  readonly stationCount: number
  readonly avgScore: number
  readonly regionCount: number
  readonly topStation: string
  readonly topScore: number
}

// --- Constants ---

const MIN_STATION_TRAFFIC = 1_000_000
const MIN_SIGNALS = 2
const LOG_MIN = Math.log(MIN_STATION_TRAFFIC)
const LOG_MAX = Math.log(
  STATION_DATA.reduce((max, s) => Math.max(max, s.annualEntries), 0) || MIN_STATION_TRAFFIC,
)

const SIGNAL_WEIGHTS = {
  footfall: 25,
  brandGap: 25,
  demographic: 15,
  density: 15,
  pedestrian: 8,
  roadTraffic: 7,
  workforceDensity: 5,
} as const

const TOTAL_WEIGHT = Object.values(SIGNAL_WEIGHTS).reduce((s, w) => s + w, 0)

export const BRAND_INCOME_AFFINITY: Record<string, IncomeAffinity> = {
  Nandos: "premium",
  McDonalds: "neutral",
  KFC: "value",
  Subway: "value",
  Dominos: "neutral",
  PapaJohns: "value",
}

export const AFFINITY_DECILE_RANGES: Record<IncomeAffinity, { label: string; min: number; max: number }> = {
  premium: { label: "6-10", min: 6, max: 10 },
  value: { label: "1-5", min: 1, max: 5 },
  neutral: { label: "3-10", min: 3, max: 10 },
}

// --- Helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

function percentileRank(value: number, sorted: readonly number[]): number {
  if (sorted.length === 0) return 0
  let count = 0
  for (const v of sorted) {
    if (v < value) count++
  }
  return Math.round((count / sorted.length) * 100)
}

// --- Road traffic precomputation ---

interface NearestRoad {
  readonly name: string
  readonly aadf: number
  readonly distance: number
  readonly driveThruCount: number
}

function findNearestRoadForStation(
  station: StationRecord,
  trafficPoints: readonly TrafficPoint[],
): NearestRoad | null {
  const latTol = 1.5 * 0.009
  const lonTol = 1.5 * 0.015
  let best: NearestRoad | null = null
  let bestDist = Infinity

  for (const tp of trafficPoints) {
    if (
      Math.abs(tp.lat - station.lat) > latTol ||
      Math.abs(tp.lon - station.lon) > lonTol
    ) {
      continue
    }
    const dist = haversineDistance(station.lat, station.lon, tp.lat, tp.lon)
    if (dist <= 1.5 && dist < bestDist) {
      bestDist = dist
      best = {
        name: tp.roadName,
        aadf: tp.aadf,
        distance: Math.round(dist * 1000),
        driveThruCount: tp.driveThruCount1500m,
      }
    }
  }

  return best
}

// --- Signal evaluators ---

function evaluateFootfall(station: StationRecord): Signal {
  const strength = station.annualEntries >= MIN_STATION_TRAFFIC
    ? Math.min((Math.log(station.annualEntries) - LOG_MIN) / (LOG_MAX - LOG_MIN), 1.0)
    : 0
  return {
    name: "footfall",
    weight: SIGNAL_WEIGHTS.footfall,
    strength,
    source: "ORR 2024-25",
    rawValue: `${fmt(station.annualEntries)} passengers/yr`,
    fired: station.annualEntries >= MIN_STATION_TRAFFIC,
  }
}

function evaluateBrandGap(station: StationRecord, brand: string): Signal {
  const brandCount = station.brandCounts800m[brand] ?? 0
  const fired = brandCount === 0 && station.qsrCount800m > 0
  // More competitors without our brand = more validated demand
  const strength = fired ? 0.6 + Math.min(station.qsrCount800m / 10, 1) * 0.2 : 0
  return {
    name: "brandGap",
    weight: SIGNAL_WEIGHTS.brandGap,
    strength,
    source: "Getplace",
    rawValue: fired
      ? `${brand} absent, ${station.qsrCount800m} competitors within 800m`
      : `${brand} has ${brandCount} location(s) within 800m`,
    fired,
  }
}

// Salary thresholds for brand affinity matching (ASHE/BRES-derived)
const HIGH_SALARY_THRESHOLD = 30_000 // top ~20% of LA averages
const LOW_SALARY_THRESHOLD = 27_000  // bottom ~40% of LA averages

function evaluateDemographic(station: StationRecord, brand: string): Signal {
  const affinity = BRAND_INCOME_AFFINITY[brand] ?? "neutral"
  const demo = REGION_DEMOGRAPHICS.find((d) => d.region === station.region)
  const salary = station.estWorkerSalary ?? 0
  const isBizDistrict = (station.workplacePop1500m ?? 0) >= 50_000

  // In business districts with worker salary data, use SIC-weighted salary
  // instead of residential income decile (which doesn't reflect lunch crowd)
  if (isBizDistrict && salary > 0) {
    let fired = false
    let strength = 0

    if (affinity === "premium" && salary >= HIGH_SALARY_THRESHOLD) {
      fired = true
      strength = 0.7 + Math.min((salary - HIGH_SALARY_THRESHOLD) / 5_000, 0.3) * 0.3
    } else if (affinity === "value" && salary < LOW_SALARY_THRESHOLD) {
      fired = true
      strength = 0.6 + Math.min((LOW_SALARY_THRESHOLD - salary) / 4_000, 0.3) * 0.3
    } else if (affinity === "neutral") {
      fired = true
      strength = 0.5
    } else {
      // Brand-salary mismatch in biz district: still fires but weak
      fired = true
      strength = 0.3
    }

    return {
      name: "demographic",
      weight: SIGNAL_WEIGHTS.demographic,
      strength,
      source: "BRES + ASHE",
      rawValue: `Business district — est. worker salary £${fmt(salary)}/yr, brand: ${affinity}`,
      fired,
    }
  }

  // Station-level: local income decile from nearby micro-areas (1.5km)
  const localDecile = station.localIncomeDecile ?? 0
  if (localDecile > 0) {
    let fired = false
    let strength = 0

    if (affinity === "premium" && localDecile >= 6) {
      fired = true
      strength = 0.7 + (localDecile - 6) * 0.1
    } else if (affinity === "value" && localDecile <= 5) {
      fired = true
      strength = 0.6 + (5 - localDecile) * 0.1
    } else if (affinity === "neutral" && localDecile >= 3) {
      fired = true
      strength = 0.5
    }

    return {
      name: "demographic",
      weight: SIGNAL_WEIGHTS.demographic,
      strength,
      source: "Local income (1.5km)",
      rawValue: `Local income decile ${localDecile} (1.5km), brand: ${affinity}`,
      fired,
    }
  }

  // Fallback: residential income decile for non-business districts
  if (!demo) {
    return {
      name: "demographic",
      weight: SIGNAL_WEIGHTS.demographic,
      strength: 0,
      source: "No data",
      rawValue: `No demographic data for ${station.region}`,
      fired: false,
    }
  }

  let fired = false
  let strength = 0

  if (affinity === "premium" && demo.medianIncomeDecile >= 6) {
    fired = true
    strength = 0.7 + (demo.medianIncomeDecile - 6) * 0.1
  } else if (affinity === "value" && demo.medianIncomeDecile <= 5) {
    fired = true
    strength = 0.6 + (5 - demo.medianIncomeDecile) * 0.1
  } else if (affinity === "neutral" && demo.medianIncomeDecile >= 3) {
    fired = true
    strength = 0.5
  }

  return {
    name: "demographic",
    weight: SIGNAL_WEIGHTS.demographic,
    strength,
    source: demo.deprivationSource,
    rawValue: `Region income decile ${demo.medianIncomeDecile} (${station.region}), brand: ${affinity}`,
    fired,
  }
}

function evaluateLowDensity(station: StationRecord, avgQsr: number): Signal {
  if (avgQsr <= 0) {
    return {
      name: "density",
      weight: SIGNAL_WEIGHTS.density,
      strength: 0,
      source: "Getplace",
      rawValue: `${station.qsrCount800m} QSR within 800m`,
      fired: false,
    }
  }

  const ratio = station.qsrCount800m / avgQsr
  const fired = ratio < 0.75
  // Linear interpolation: ratio 0 → 0.8, ratio 0.75 → 0
  const strength = fired ? (1 - ratio / 0.75) * 0.8 : 0

  return {
    name: "density",
    weight: SIGNAL_WEIGHTS.density,
    strength,
    source: "Getplace",
    rawValue: `${station.qsrCount800m} QSR within 800m (avg: ${Math.round(avgQsr)})`,
    fired,
  }
}

function evaluatePedestrian(station: StationRecord): Signal {
  const busStops = station.busStopCount800m ?? 0
  const fired = busStops >= 30
  // Linear ramp: 30 stops → 0.3, 100+ stops → 0.9
  const strength = fired ? Math.min((busStops - 30) / 70, 1) * 0.6 + 0.3 : 0

  return {
    name: "pedestrian",
    weight: SIGNAL_WEIGHTS.pedestrian,
    strength,
    source: "NaPTAN",
    rawValue: `${busStops} bus stops within 800m`,
    fired,
  }
}

function evaluateRoadTraffic(nearestRoad: NearestRoad | null): Signal {
  if (!nearestRoad) {
    return {
      name: "roadTraffic",
      weight: SIGNAL_WEIGHTS.roadTraffic,
      strength: 0,
      source: "DfT AADF",
      rawValue: "No high-traffic road within 1.5km",
      fired: false,
    }
  }

  const fired = nearestRoad.aadf >= 50_000 && nearestRoad.driveThruCount < 2
  // Linear ramp: 50K → 0.5, 150K+ → 0.9
  const strength = fired ? Math.min((nearestRoad.aadf - 50_000) / 100_000, 1) * 0.4 + 0.5 : 0

  return {
    name: "roadTraffic",
    weight: SIGNAL_WEIGHTS.roadTraffic,
    strength,
    source: "DfT AADF",
    rawValue: `${nearestRoad.name} — ${fmt(nearestRoad.aadf)} vehicles/day, ${nearestRoad.driveThruCount} drive-thru nearby`,
    fired,
  }
}

function evaluateWorkforceDensity(station: StationRecord): Signal {
  const wp = station.workplacePop1500m ?? 0
  const fired = wp >= 10_000
  // Log-scale ramp: 10K → 0.3, ~32K → 0.6, 100K+ → 0.9
  const strength = fired
    ? Math.min((Math.log(wp) - Math.log(10_000)) / (Math.log(100_000) - Math.log(10_000)), 1) * 0.6 + 0.3
    : 0

  return {
    name: "workforceDensity",
    weight: SIGNAL_WEIGHTS.workforceDensity,
    strength,
    source: "Census 2021",
    rawValue: wp > 0 ? `${fmt(wp)} workers within 1.5km` : "No workplace data",
    fired,
  }
}

// --- Scoring ---

function computeBrandScore(signals: readonly Signal[]): number {
  const firedSignals = signals.filter((s) => s.fired)
  if (firedSignals.length < MIN_SIGNALS) return 0

  const baseScore = firedSignals.reduce(
    (sum, s) => sum + (s.weight / TOTAL_WEIGHT) * s.strength * 100,
    0,
  )

  const confidenceMultiplier = 1 + 0.05 * (firedSignals.length - 2)
  return Math.round(clamp(baseScore * confidenceMultiplier, 0, 100))
}

function buildSignalProfile(signals: readonly Signal[]): SignalProfile {
  const byName: Record<string, number> = {}
  for (const s of signals) {
    byName[s.name] = s.fired ? Math.round(s.strength * 100) : 0
  }
  return {
    footfall: byName["footfall"] ?? 0,
    brandGap: byName["brandGap"] ?? 0,
    demographic: byName["demographic"] ?? 0,
    density: byName["density"] ?? 0,
    pedestrian: byName["pedestrian"] ?? 0,
    roadTraffic: byName["roadTraffic"] ?? 0,
    workforceDensity: byName["workforceDensity"] ?? 0,
  }
}

// --- Per-Station Analysis ---

function analyzeStation(
  station: StationRecord,
  brandGaps: readonly BrandGap[],
  nearestRoad: NearestRoad | null,
  sortedFootfall: readonly number[],
  sortedQsr: readonly number[],
  sortedPedestrian: readonly number[],
  avgQsr: number,
): StationAnalysis {
  const footfallPct = percentileRank(station.annualEntries, sortedFootfall)
  const qsrPct = percentileRank(station.qsrCount800m, sortedQsr)
  const pedPct = percentileRank(station.busStopCount800m ?? 0, sortedPedestrian)

  const demandEvidence: CitedFact[] = []
  const supplyGapEvidence: CitedFact[] = []
  const riskFactors: CitedFact[] = []
  const missingDataNotes: string[] = []

  // Demand evidence
  demandEvidence.push({
    text: `${fmt(station.annualEntries)} passengers/year — top ${100 - footfallPct}% nationally`,
    source: "ORR Station Usage 2024-25",
    sourceType: "gov",
    verifiable: true,
  })

  if ((station.busStopCount800m ?? 0) >= 30) {
    demandEvidence.push({
      text: `${station.busStopCount800m} bus stops within 800m — top ${100 - pedPct}% for pedestrian activity`,
      source: "NaPTAN",
      sourceType: "gov",
      verifiable: true,
    })
  }

  if (nearestRoad && nearestRoad.aadf >= 50_000) {
    demandEvidence.push({
      text: `${nearestRoad.name} nearby — ${fmt(nearestRoad.aadf)} vehicles/day, ${nearestRoad.distance}m away`,
      source: "DfT AADF",
      sourceType: "gov",
      verifiable: true,
    })
  }

  if (station.qsrCount800m > 0) {
    demandEvidence.push({
      text: `${station.qsrCount800m} QSR competitors already present — validates commercial demand`,
      source: "Getplace",
      sourceType: "getplace",
      verifiable: true,
    })
  }

  const wp = station.workplacePop1500m ?? 0
  if (wp >= 20_000) {
    demandEvidence.push({
      text: `${fmt(wp)} workers within 1.5km — business district with strong lunchtime demand`,
      source: "Census 2021 WP001",
      sourceType: "gov",
      verifiable: true,
    })
  }

  // Supply gap evidence
  const absentBrands = brandGaps.map((bg) => bg.brand)
  if (absentBrands.length > 0) {
    supplyGapEvidence.push({
      text: `${absentBrands.join(", ")} absent despite ${station.qsrCount800m} competitor locations within 800m`,
      source: "Getplace",
      sourceType: "getplace",
      verifiable: true,
    })
  }

  if (avgQsr > 0 && station.qsrCount800m < avgQsr * 0.75) {
    const shortfall = Math.round((1 - station.qsrCount800m / avgQsr) * 100)
    supplyGapEvidence.push({
      text: `QSR density ${shortfall}% below average for stations of similar traffic`,
      source: "ORR + Getplace",
      sourceType: "derived",
      verifiable: true,
    })
  }

  const ratio = station.annualEntries / Math.max(station.qsrCount800m, 1)
  const nationalAvgRatio = 5_000_000 // approximate
  if (ratio > nationalAvgRatio * 1.5) {
    supplyGapEvidence.push({
      text: `${fmt(Math.round(ratio))} passengers per QSR — ${Math.round(ratio / nationalAvgRatio)}x above typical`,
      source: "ORR + Getplace",
      sourceType: "derived",
      verifiable: true,
    })
  }

  if (nearestRoad && nearestRoad.aadf >= 50_000 && nearestRoad.driveThruCount < 2) {
    supplyGapEvidence.push({
      text: `Only ${nearestRoad.driveThruCount} drive-thru near ${nearestRoad.name} (${fmt(nearestRoad.aadf)} vehicles/day) — drive-thru corridor opportunity`,
      source: "DfT AADF + Getplace",
      sourceType: "derived",
      verifiable: true,
    })
  }

  // Risk factors
  if (station.qsrCount800m >= 15) {
    riskFactors.push({
      text: `High competition: ${station.qsrCount800m} QSR already present within 800m`,
      source: "Getplace",
      sourceType: "getplace",
      verifiable: true,
    })
  }

  if (station.region === "London") {
    riskFactors.push({
      text: "London location — likely premium rental costs",
      source: "Contextual",
      sourceType: "derived",
      verifiable: false,
    })
  }

  const demo = REGION_DEMOGRAPHICS.find((d) => d.region === station.region)
  const hasLocalIncome = (station.localIncomeDecile ?? 0) > 0
  if (!demo && !hasLocalIncome) {
    missingDataNotes.push(`Demographic data unavailable for ${station.region}`)
  }

  if (!nearestRoad) {
    missingDataNotes.push("No road traffic data within 1.5km — road traffic signal excluded")
  }

  if (wp === 0) {
    missingDataNotes.push("No workplace population data — Census 2021 covers England & Wales only")
  }

  // Data completeness: 7 possible data sources
  let sourcesWithData = 4 // ORR, NaPTAN bus, Getplace brands, Getplace QSR always present
  if (demo || hasLocalIncome) sourcesWithData++
  if (nearestRoad) sourcesWithData++
  if (wp > 0) sourcesWithData++
  const dataCompleteness = Math.round((sourcesWithData / 7) * 100)

  return {
    footfallPercentile: footfallPct,
    qsrDensityPercentile: qsrPct,
    pedestrianPercentile: pedPct,
    demandEvidence,
    supplyGapEvidence,
    riskFactors,
    dataCompleteness,
    missingDataNotes,
  }
}

// --- Main computation ---

export function computeStationOpportunities(
  allBrands: readonly string[],
): readonly StationOpportunity[] {
  if (!STATION_DATA || STATION_DATA.length === 0) return []

  const busyStations = STATION_DATA.filter(
    (s) => s.annualEntries >= MIN_STATION_TRAFFIC,
  )
  const avgQsr =
    busyStations.reduce((sum, s) => sum + s.qsrCount800m, 0) /
    Math.max(busyStations.length, 1)

  // Precompute sorted arrays for percentile calculation
  const sortedFootfall = [...busyStations.map((s) => s.annualEntries)].sort((a, b) => a - b)
  const sortedQsr = [...busyStations.map((s) => s.qsrCount800m)].sort((a, b) => a - b)
  const sortedPedestrian = [...busyStations.map((s) => s.busStopCount800m ?? 0)].sort((a, b) => a - b)

  // Precompute road traffic for all stations
  const roadCache = new Map<string, NearestRoad | null>()
  for (const station of busyStations) {
    roadCache.set(station.name, findNearestRoadForStation(station, TRAFFIC_DATA))
  }

  const results: StationOpportunity[] = []

  for (const station of busyStations) {
    const nearestRoad = roadCache.get(station.name) ?? null
    const brandGaps: BrandGap[] = []
    const presentBrands: { brand: string; count: number }[] = []
    let bestSignalProfile: SignalProfile | null = null
    let maxScore = 0
    let maxSignalCount = 0

    for (const brand of allBrands) {
      const brandCount = station.brandCounts800m[brand] ?? 0

      if (brandCount > 0) {
        presentBrands.push({ brand, count: brandCount })
        continue
      }

      // Brand is absent — evaluate all signals
      const signals: Signal[] = [
        evaluateFootfall(station),
        evaluateBrandGap(station, brand),
        evaluateDemographic(station, brand),
        evaluateLowDensity(station, avgQsr),
        evaluatePedestrian(station),
        evaluateRoadTraffic(nearestRoad),
        evaluateWorkforceDensity(station),
      ]

      const score = computeBrandScore(signals)
      if (score === 0) continue

      const firedCount = signals.filter((s) => s.fired).length
      const affinity = BRAND_INCOME_AFFINITY[brand] ?? "neutral"

      brandGaps.push({ brand, score, signals, affinity })

      if (score > maxScore) {
        maxScore = score
        maxSignalCount = firedCount
        bestSignalProfile = buildSignalProfile(signals)
      }
    }

    if (brandGaps.length === 0) continue

    // Sort brand gaps by score descending
    const sortedGaps = [...brandGaps].sort((a, b) => b.score - a.score)

    const confidence: ConfidenceLevel =
      maxSignalCount >= 4 ? "high" : maxSignalCount >= 3 ? "medium" : "low"

    const analysis = analyzeStation(
      station, sortedGaps, nearestRoad,
      sortedFootfall, sortedQsr, sortedPedestrian, avgQsr,
    )

    results.push({
      rank: 0,
      station,
      compositeScore: maxScore,
      confidence,
      signalCount: maxSignalCount,
      brandGaps: sortedGaps,
      presentBrands,
      nearestRoad: nearestRoad
        ? { name: nearestRoad.name, aadf: nearestRoad.aadf, distance: nearestRoad.distance }
        : null,
      signalProfile: bestSignalProfile ?? {
        footfall: 0, brandGap: 0, demographic: 0,
        density: 0, pedestrian: 0, roadTraffic: 0, workforceDensity: 0,
      },
      analysis,
    })
  }

  return results
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .map((opp, i) => ({ ...opp, rank: i + 1 }))
}

/**
 * Compute a location-level signal profile for every busy station,
 * independent of brand-specific opportunity scoring.
 * Used to display signal bars in popups even when no brand gap exists.
 */
export function computeAllStationSignals(): ReadonlyMap<string, SignalProfile> {
  if (!STATION_DATA || STATION_DATA.length === 0) return new Map()

  const busyStations = STATION_DATA.filter(
    (s) => s.annualEntries >= MIN_STATION_TRAFFIC,
  )
  const avgQsr =
    busyStations.reduce((sum, s) => sum + s.qsrCount800m, 0) /
    Math.max(busyStations.length, 1)

  const roadCache = new Map<string, NearestRoad | null>()
  for (const station of busyStations) {
    roadCache.set(station.name, findNearestRoadForStation(station, TRAFFIC_DATA))
  }

  const result = new Map<string, SignalProfile>()

  for (const station of busyStations) {
    const nearestRoad = roadCache.get(station.name) ?? null
    const signals: Signal[] = [
      evaluateFootfall(station),
      { name: "brandGap", weight: SIGNAL_WEIGHTS.brandGap, strength: 0, source: "n/a", rawValue: "", fired: false },
      evaluateDemographic(station, "__neutral__"),
      evaluateLowDensity(station, avgQsr),
      evaluatePedestrian(station),
      evaluateRoadTraffic(nearestRoad),
      evaluateWorkforceDensity(station),
    ]
    result.set(station.name, buildSignalProfile(signals))
  }

  return result
}

// --- Narrative generator ---

export function generateNarrative(
  stations: readonly StationOpportunity[],
  brandLabel: string,
): readonly NarrativeSentence[] {
  if (stations.length === 0) return []

  const sentences: NarrativeSentence[] = []
  const regionSet = new Set(stations.map((s) => s.station.region))
  const top20 = stations.slice(0, 20)
  const avgScore = top20.length > 0
    ? Math.round(top20.reduce((s, o) => s + o.compositeScore, 0) / top20.length)
    : 0

  // Sentence 1: Summary
  const highConfidence = stations.filter((s) => s.confidence === "high").length
  sentences.push({
    text: `We identified ${stations.length} station areas with expansion opportunities for ${brandLabel} across ${regionSet.size} regions, averaging ${avgScore}/100 confidence. ${highConfidence} stations show high-confidence convergence (4+ signals).`,
    sources: ["ORR 2024-25", "Getplace", "NaPTAN", "UK Deprivation Indices", "DfT AADF"],
  })

  // Sentence 2: Geographic concentration
  const regionCounts = new Map<string, number>()
  for (const s of stations) {
    regionCounts.set(s.station.region, (regionCounts.get(s.station.region) ?? 0) + 1)
  }
  const sortedRegions = [...regionCounts.entries()].sort((a, b) => b[1] - a[1])
  if (sortedRegions.length >= 2) {
    sentences.push({
      text: `Highest concentration in ${sortedRegions[0][0]} (${sortedRegions[0][1]} stations), followed by ${sortedRegions[1][0]} (${sortedRegions[1][1]}).`,
      sources: ["ORR 2024-25"],
    })
  }

  // Sentence 3: Top pick
  if (stations.length > 0) {
    const top = stations[0]
    const gapBrands = top.brandGaps.map((bg) => bg.brand).join(", ")
    sentences.push({
      text: `#1 ${top.station.name}: ${top.signalCount} signals converge at score ${top.compositeScore}/100. ${gapBrands} absent despite ${top.station.qsrCount800m} competitors and ${fmt(top.station.annualEntries)} passengers/year.`,
      sources: ["ORR 2024-25", "Getplace"],
    })
  }

  // Sentence 4: Road traffic (conditional)
  const roadStations = stations.filter(
    (s) => s.nearestRoad && s.nearestRoad.aadf >= 50_000,
  )
  if (roadStations.length > 0) {
    sentences.push({
      text: `Road traffic analysis reveals ${roadStations.length} stations near high-volume roads (50K+ vehicles/day) — potential drive-thru corridor opportunities currently underserved.`,
      sources: ["DfT AADF", "Getplace"],
    })
  }

  // Sentence 5: Brand gaps summary
  const brandGapCounts = new Map<string, number>()
  for (const s of stations) {
    for (const bg of s.brandGaps) {
      brandGapCounts.set(bg.brand, (brandGapCounts.get(bg.brand) ?? 0) + 1)
    }
  }
  const sortedBrandGaps = [...brandGapCounts.entries()].sort((a, b) => b[1] - a[1])
  if (sortedBrandGaps.length > 0) {
    const [topBrand, topCount] = sortedBrandGaps[0]
    const totalBusyStations = STATION_DATA.filter((s) => s.annualEntries >= MIN_STATION_TRAFFIC).length
    const pct = Math.round((topCount / totalBusyStations) * 100)
    sentences.push({
      text: `${topBrand} has the largest expansion gap — absent from ${pct}% of high-traffic station areas (${topCount} of ${totalBusyStations}).`,
      sources: ["ORR 2024-25", "Getplace"],
    })
  }

  return sentences
}

// --- KPI computation ---

export function computeKpis(
  stations: readonly StationOpportunity[],
): OpportunityKpis {
  const top20 = stations.slice(0, 20)
  const avgScore = top20.length > 0
    ? Math.round(top20.reduce((s, o) => s + o.compositeScore, 0) / top20.length)
    : 0
  const regionSet = new Set(stations.map((s) => s.station.region))

  return {
    stationCount: stations.length,
    avgScore,
    regionCount: regionSet.size,
    topStation: stations[0]?.station.name ?? "—",
    topScore: stations[0]?.compositeScore ?? 0,
  }
}
