// Synthetic opening dates for brand points (2015–2025)
// Each brand has a logistic growth curve with a different peak year:
//   Subway (oldest, peak 2016) → PapaJohns (newest, peak 2023)
// Index order matches BRAND_POINTS[brand] exactly.

import { BRAND_POINTS } from "./brand-points"

// Logistic CDF: 1 / (1 + exp(-k*(x - midpoint)))
function logisticCdf(x: number, midpoint: number, k: number): number {
  return 1 / (1 + Math.exp(-k * (x - midpoint)))
}

// Deterministic pseudo-random from index (for jitter)
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49271
  return x - Math.floor(x)
}

// Brand midpoints (months since Jan 2015) and steepness
const BRAND_CURVES: Record<string, { midpoint: number; k: number }> = {
  Subway: { midpoint: 18, k: 0.12 },       // peak ~mid 2016
  McDonalds: { midpoint: 30, k: 0.10 },    // peak ~mid 2017
  KFC: { midpoint: 42, k: 0.11 },          // peak ~mid 2018
  Dominos: { midpoint: 54, k: 0.09 },      // peak ~mid 2019
  Nandos: { midpoint: 72, k: 0.10 },       // peak ~mid 2021
  PapaJohns: { midpoint: 96, k: 0.08 },    // peak ~mid 2023
}

const MIN_MONTH = 0    // Jan 2015
const MAX_MONTH = 131  // Dec 2025

function generateBrandDates(brand: string): readonly Date[] {
  const pts = BRAND_POINTS[brand] || []
  const curve = BRAND_CURVES[brand] || { midpoint: 60, k: 0.1 }

  return pts.map((_, i) => {
    // Use logistic CDF to assign a cumulative fraction
    // Then map that fraction to a month in [MIN_MONTH, MAX_MONTH]
    const fraction = (i + 0.5) / pts.length
    // Inverse logistic: find month where CDF ≈ fraction
    // CDF(m) = 1/(1+exp(-k*(m - mid)))
    // => m = mid - (1/k)*ln((1/fraction) - 1)
    const clampedFraction = Math.max(0.001, Math.min(0.999, fraction))
    const rawMonth = curve.midpoint - (1 / curve.k) * Math.log(1 / clampedFraction - 1)

    // Add per-point jitter (±2 months) for realism
    const jitter = (seededRandom(i * 31 + brand.length * 17) - 0.5) * 4
    const month = Math.round(Math.max(MIN_MONTH, Math.min(MAX_MONTH, rawMonth + jitter)))

    const year = 2015 + Math.floor(month / 12)
    const monthOfYear = month % 12
    return new Date(year, monthOfYear, 1)
  })
}

export const OPEN_DATES: Record<string, readonly Date[]> = Object.fromEntries(
  Object.keys(BRAND_CURVES).map((brand) => [brand, generateBrandDates(brand)])
)
