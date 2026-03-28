// Export station opportunities as JSON for Claude AI analysis
// Run: npx tsx --tsconfig tsconfig.app.json scripts/export-opportunities.ts
// Optional: npx tsx --tsconfig tsconfig.app.json scripts/export-opportunities.ts --batch 0 --size 15
// Outputs batch N of SIZE stations (for parallel agent processing)

import { computeStationOpportunities, fmt } from "../src/lib/opportunity-scoring"

const ALL_BRANDS = ["Subway", "McDonalds", "Dominos", "KFC", "Nandos", "PapaJohns"]

// Parse CLI args for batching
const args = process.argv.slice(2)
const batchIdx = args.includes("--batch") ? parseInt(args[args.indexOf("--batch") + 1], 10) : -1
const batchSize = args.includes("--size") ? parseInt(args[args.indexOf("--size") + 1], 10) : 15

const allStations = computeStationOpportunities(ALL_BRANDS)

const stations = batchIdx >= 0
  ? allStations.slice(batchIdx * batchSize, (batchIdx + 1) * batchSize)
  : allStations

const output = stations.map((opp) => ({
  rank: opp.rank,
  name: opp.station.name,
  region: opp.station.region,
  lat: opp.station.lat,
  lon: opp.station.lon,
  compositeScore: opp.compositeScore,
  confidence: opp.confidence,
  signalCount: opp.signalCount,
  annualPassengers: opp.station.annualEntries,
  annualPassengersFormatted: fmt(opp.station.annualEntries),
  qsrCount800m: opp.station.qsrCount800m,
  busStopCount800m: opp.station.busStopCount800m,
  workplacePop1500m: opp.station.workplacePop1500m ?? 0,
  workplacePop1500mFormatted: fmt(opp.station.workplacePop1500m ?? 0),
  nearestRoad: opp.nearestRoad,
  brandGaps: opp.brandGaps.map((bg) => ({
    brand: bg.brand,
    score: bg.score,
    affinity: bg.affinity,
    firedSignals: bg.signals
      .filter((s) => s.fired)
      .map((s) => ({
        name: s.name,
        weight: s.weight,
        strength: s.strength,
        source: s.source,
        rawValue: s.rawValue,
      })),
  })),
  presentBrands: opp.presentBrands,
  analysis: {
    footfallPercentile: opp.analysis.footfallPercentile,
    qsrDensityPercentile: opp.analysis.qsrDensityPercentile,
    pedestrianPercentile: opp.analysis.pedestrianPercentile,
    demandEvidence: opp.analysis.demandEvidence,
    supplyGapEvidence: opp.analysis.supplyGapEvidence,
    riskFactors: opp.analysis.riskFactors,
    dataCompleteness: opp.analysis.dataCompleteness,
    missingDataNotes: opp.analysis.missingDataNotes,
  },
}))

// Summary stats (from ALL stations, regardless of batch)
const totalBusyStations = allStations.length
const highConfidence = allStations.filter((s) => s.confidence === "high").length
const regionSet = new Set(allStations.map((s) => s.station.region))

const summary = {
  totalStationOpportunities: totalBusyStations,
  highConfidenceCount: highConfidence,
  regionsCount: regionSet.size,
  regions: [...regionSet],
  avgScoreTop20: Math.round(
    allStations.slice(0, 20).reduce((s, o) => s + o.compositeScore, 0) / Math.min(allStations.length, 20),
  ),
  batchInfo: batchIdx >= 0
    ? { batch: batchIdx, size: batchSize, stationsInBatch: stations.length, totalBatches: Math.ceil(allStations.length / batchSize) }
    : null,
}

console.log(JSON.stringify({ summary, stations: output }, null, 2))
