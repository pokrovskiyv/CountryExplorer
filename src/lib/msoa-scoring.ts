// MSOA Zone Opportunity Scoring — area-level analysis for QSR expansion
// 4-signal weighted model using MSOA centroids + workplace population + brand proximity
// Computed lazily at runtime from already-loaded data (no pre-computation script needed)

import { WORKPLACE_POP } from "@/data/workplace-pop-data"
import { STATION_DATA } from "@/data/station-data"
import { REGION_DEMOGRAPHICS } from "@/data/demographic-data"
import { countPointsInRadius, haversineDistance } from "./geo-utils"
import { BRAND_INCOME_AFFINITY, AFFINITY_DECILE_RANGES } from "./opportunity-scoring"
import type { ConfidenceLevel } from "./opportunity-scoring"
import type { MsoaOpportunity, MsoaSignalProfile, MsoaAnalysis } from "./multi-anchor-types"

// Signal weights
const SIGNAL_WEIGHTS = {
  workforceDensity: 30,
  qsrDensityGap: 25,
  demographicFit: 25,
  footfallProximity: 20,
}

const MIN_SIGNALS = 2
const RADIUS_KM = 1.5
const STATION_RADIUS_KM = 2.0
const MIN_WORKPLACE_POP = 5_000

// Pre-compute percentiles for workplace population
const sortedWP = [...WORKPLACE_POP].map((p) => p[2]).sort((a, b) => a - b)
const wpMedian = sortedWP[Math.floor(sortedWP.length / 2)]

// Average QSR count across all MSOAs (computed once)
let avgQsrCount: number | null = null

function evalWorkforceDensity(workplacePop: number): { strength: number; fired: boolean } {
  if (workplacePop < MIN_WORKPLACE_POP) return { strength: 0, fired: false }
  // Log-scale: 5K→0.3, 20K→0.6, 50K+→0.9
  const logVal = Math.log(Math.max(workplacePop, MIN_WORKPLACE_POP))
  const logMin = Math.log(MIN_WORKPLACE_POP)
  const logMax = Math.log(50_000)
  const strength = Math.min(0.9, 0.3 + ((logVal - logMin) / (logMax - logMin)) * 0.6)
  return { strength, fired: true }
}

function evalQsrDensityGap(
  qsrCount: number,
  workplacePop: number,
  avgQsr: number,
): { strength: number; fired: boolean } {
  // Below-average QSR count for zones with meaningful workplace population
  if (workplacePop < MIN_WORKPLACE_POP) return { strength: 0, fired: false }
  if (qsrCount >= avgQsr * 0.75) return { strength: 0, fired: false }
  // Lower QSR = stronger signal
  const ratio = qsrCount / Math.max(avgQsr, 1)
  const strength = Math.min(0.9, 0.9 - ratio * 0.6)
  return { strength, fired: true }
}

function evalDemographicFit(
  region: string,
  brand: string,
): { strength: number; fired: boolean } {
  const demo = REGION_DEMOGRAPHICS.find((d) => d.region === region)
  if (!demo) return { strength: 0, fired: false }
  const affinity = BRAND_INCOME_AFFINITY[brand] ?? "neutral"
  const range = AFFINITY_DECILE_RANGES[affinity]
  const decile = demo.medianIncomeDecile ?? 5
  if (decile >= range.min && decile <= range.max) {
    return { strength: 0.6, fired: true }
  }
  return { strength: 0, fired: false }
}

function evalFootfallProximity(
  lat: number,
  lon: number,
): { strength: number; fired: boolean; nearestStation: MsoaAnalysis["nearestStation"] } {
  let nearest: MsoaAnalysis["nearestStation"] = null
  let minDist = Infinity

  for (const station of STATION_DATA) {
    if (station.annualEntries < 1_000_000) continue
    const dist = haversineDistance(lat, lon, station.lat, station.lon)
    if (dist < minDist) {
      minDist = dist
      nearest = {
        name: station.name,
        distance: dist,
        footfall: station.annualEntries,
      }
    }
  }

  if (!nearest || minDist > STATION_RADIUS_KM) {
    return { strength: 0, fired: false, nearestStation: nearest }
  }

  // Closer + higher footfall = stronger
  const distFactor = 1 - (minDist / STATION_RADIUS_KM)
  const footfallFactor = Math.min(1, Math.log(nearest.footfall) / Math.log(50_000_000))
  const strength = Math.min(0.9, distFactor * 0.5 + footfallFactor * 0.4)
  return { strength, fired: true, nearestStation: nearest }
}

// Find which region an MSOA centroid belongs to using regions topo
function findRegion(lat: number, lon: number): string {
  // Simple nearest-region heuristic using REGION_DEMOGRAPHICS centroids
  // This is approximate but sufficient for scoring
  let nearest = "London"
  let minDist = Infinity
  for (const demo of REGION_DEMOGRAPHICS) {
    // Use station data to approximate region centroids
    const stationsInRegion = STATION_DATA.filter((s) => s.region === demo.region)
    if (stationsInRegion.length === 0) continue
    const avgLat = stationsInRegion.reduce((s, st) => s + st.lat, 0) / stationsInRegion.length
    const avgLon = stationsInRegion.reduce((s, st) => s + st.lon, 0) / stationsInRegion.length
    const dist = haversineDistance(lat, lon, avgLat, avgLon)
    if (dist < minDist) {
      minDist = dist
      nearest = demo.region
    }
  }
  return nearest
}

export function computeMsoaOpportunities(
  allBrands: readonly string[],
  brandPoints: Record<string, readonly (readonly [number, number, ...unknown[]])[]>,
): readonly MsoaOpportunity[] {
  // Compute average QSR count once
  if (avgQsrCount === null) {
    let totalQsr = 0
    let zonesWithQsr = 0
    for (const [lat, lon] of WORKPLACE_POP) {
      let qsr = 0
      for (const brand of allBrands) {
        const pts = brandPoints[brand]
        if (pts) qsr += countPointsInRadius(lat, lon, pts, RADIUS_KM)
      }
      totalQsr += qsr
      if (qsr > 0) zonesWithQsr++
    }
    avgQsrCount = zonesWithQsr > 0 ? totalQsr / zonesWithQsr : 3
  }

  const scored: MsoaOpportunity[] = []

  for (let i = 0; i < WORKPLACE_POP.length; i++) {
    const [lat, lon, workplacePop] = WORKPLACE_POP[i]

    // Skip low-population zones early
    if (workplacePop < MIN_WORKPLACE_POP) continue

    const region = findRegion(lat, lon)

    // Count QSR within radius
    let qsrCount = 0
    const brandGaps: string[] = []
    for (const brand of allBrands) {
      const pts = brandPoints[brand]
      if (!pts) continue
      const count = countPointsInRadius(lat, lon, pts, RADIUS_KM)
      qsrCount += count
      if (count === 0) brandGaps.push(brand)
    }

    // Skip zones where all brands are present
    if (brandGaps.length === 0) continue

    // Evaluate signals
    const wd = evalWorkforceDensity(workplacePop)
    const qg = evalQsrDensityGap(qsrCount, workplacePop, avgQsrCount)
    const fp = evalFootfallProximity(lat, lon)

    // Demographic: best across brands
    let bestDemo = { strength: 0, fired: false }
    for (const brand of allBrands) {
      const d = evalDemographicFit(region, brand)
      if (d.strength > bestDemo.strength) bestDemo = d
    }

    const signals = [
      { weight: SIGNAL_WEIGHTS.workforceDensity, ...wd },
      { weight: SIGNAL_WEIGHTS.qsrDensityGap, ...qg },
      { weight: SIGNAL_WEIGHTS.demographicFit, ...bestDemo },
      { weight: SIGNAL_WEIGHTS.footfallProximity, ...fp },
    ]

    const firedCount = signals.filter((s) => s.fired).length
    if (firedCount < MIN_SIGNALS) continue

    const raw = signals.reduce((sum, s) => sum + (s.fired ? s.weight * s.strength : 0), 0)
    const confidenceBonus = firedCount >= 4 ? 1.15 : firedCount >= 3 ? 1.05 : 1.0
    const score = Math.round(Math.min(100, raw * confidenceBonus))
    if (score === 0) continue

    const confidence: ConfidenceLevel = firedCount >= 4 ? "high" : firedCount >= 3 ? "medium" : "low"

    // Build analysis
    const demandEvidence: string[] = []
    const riskFactors: string[] = []

    if (workplacePop >= 20_000) {
      demandEvidence.push(`${Math.round(workplacePop / 1000)}K workers in this zone (Census 2021)`)
    }
    if (qsrCount === 0) {
      demandEvidence.push(`Zero QSR within ${RADIUS_KM}km — completely underserved area`)
    } else if (qsrCount < avgQsrCount * 0.5) {
      demandEvidence.push(`Only ${qsrCount} QSR within ${RADIUS_KM}km — well below average`)
    }
    if (fp.nearestStation && fp.fired) {
      demandEvidence.push(`${fp.nearestStation.name} station ${fp.nearestStation.distance.toFixed(1)}km away with ${Math.round(fp.nearestStation.footfall / 1_000_000)}M pax/yr`)
    }

    if (workplacePop < 10_000) {
      riskFactors.push(`Moderate workplace population (${Math.round(workplacePop / 1000)}K) — may not sustain standalone QSR`)
    }
    if (brandGaps.length >= 5) {
      riskFactors.push(`${brandGaps.length} of ${allBrands.length} brands absent — area may lack commercial infrastructure`)
    }

    const msoaCode = `MSOA-${i.toString().padStart(5, "0")}`

    scored.push({
      id: `msoa:${msoaCode}`,
      anchorType: "msoa",
      rank: 0,
      compositeScore: score,
      confidence,
      signalCount: firedCount,
      lat,
      lng: lon,
      region,
      label: `Zone ${region} #${i + 1}`,
      msoaCode,
      signalProfile: {
        brandGap: brandGaps.length > 0 ? Math.round((brandGaps.length / allBrands.length) * 100) : 0,
        qsrDensityGap: qg.fired ? Math.round(qg.strength * 100) : 0,
        demographicFit: bestDemo.fired ? Math.round(bestDemo.strength * 100) : 0,
        workforceDensity: wd.fired ? Math.round(wd.strength * 100) : 0,
        footfallProximity: fp.fired ? Math.round(fp.strength * 100) : 0,
      },
      analysis: {
        deprivationDecile: 0, // Not available without TopoJSON lookup
        workplacePop,
        nearestStation: fp.nearestStation,
        demandEvidence,
        riskFactors,
      },
      brandGaps,
      qsrCount,
    })
  }

  scored.sort((a, b) => b.compositeScore - a.compositeScore)
  return scored.map((opp, i) => ({ ...opp, rank: i + 1 }))
}
