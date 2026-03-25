import { describe, it, expect } from "vitest"
import { REGION_DEMOGRAPHICS } from "@/data/demographic-data"
import { computeStationOpportunities } from "@/lib/opportunity-scoring"

describe("UK-wide demographic data", () => {
  it("has avgImdScore in 0-100 range for all regions", () => {
    for (const d of REGION_DEMOGRAPHICS) {
      expect(d.avgImdScore).toBeGreaterThanOrEqual(0)
      expect(d.avgImdScore).toBeLessThanOrEqual(100)
    }
  })

  it("has medianIncomeDecile in 1-10 range for all regions", () => {
    for (const d of REGION_DEMOGRAPHICS) {
      expect(d.medianIncomeDecile).toBeGreaterThanOrEqual(1)
      expect(d.medianIncomeDecile).toBeLessThanOrEqual(10)
    }
  })

  it("has deprivationSource for all regions", () => {
    const validSources = ["IMD 2025", "WIMD 2025", "SIMD 2020", "NIMDM 2017"]
    for (const d of REGION_DEMOGRAPHICS) {
      expect(validSources).toContain(d.deprivationSource)
    }
  })

  it("has microAreaLabel for all regions", () => {
    const validLabels = ["LSOAs", "Data Zones", "SOAs"]
    for (const d of REGION_DEMOGRAPHICS) {
      expect(validLabels).toContain(d.microAreaLabel)
    }
  })
})
