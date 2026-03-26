import { describe, it, expect } from "vitest"
import { STATION_DATA } from "@/data/station-data"
import { computeStationOpportunities } from "@/lib/opportunity-scoring"

describe("localIncomeDecile field", () => {
  it("exists on all stations with value 0-10", () => {
    for (const s of STATION_DATA) {
      expect(s.localIncomeDecile).toBeGreaterThanOrEqual(0)
      expect(s.localIncomeDecile).toBeLessThanOrEqual(10)
    }
  })

  it("Bond Street (West End) has local decile higher than London region (3)", () => {
    const bond = STATION_DATA.find((s) => s.name === "Bond Street")
    expect(bond).toBeDefined()
    // Bond Street is in the affluent West End — local decile should exceed the London region average
    expect(bond!.localIncomeDecile).toBeGreaterThan(3)
  })

  it("Bradford Interchange (deprived) has low local decile", () => {
    const bradford = STATION_DATA.find((s) => s.name.includes("Bradford Interchange"))
    expect(bradford).toBeDefined()
    // Bradford is among England's most deprived areas — local decile should be low
    expect(bradford!.localIncomeDecile).toBeLessThanOrEqual(3)
  })

  it("majority of stations have local income data (non-zero)", () => {
    const withData = STATION_DATA.filter((s) => s.localIncomeDecile > 0)
    // Expect at least 90% of stations to have nearby micro-areas with income data
    expect(withData.length / STATION_DATA.length).toBeGreaterThan(0.9)
  })
})

describe("evaluateDemographic uses localIncomeDecile", () => {
  it("non-business district station uses local income decile when available", () => {
    const opps = computeStationOpportunities(["Nandos"])
    // Find a non-business-district station (workplacePop < 50k) with local income data
    const nonBiz = opps.find(
      (o) =>
        (o.station.workplacePop1500m ?? 0) < 50_000 &&
        o.station.localIncomeDecile > 0,
    )
    if (nonBiz) {
      // Signals are on individual brand gaps
      const demoSignal = nonBiz.brandGaps
        .flatMap((g) => g.signals)
        .find((s) => s.name === "demographic")
      expect(demoSignal).toBeDefined()
      expect(demoSignal!.source).toBe("Local income (1.5km)")
    }
  })

  it("demographic signal rawValue includes local decile text for non-business stations", () => {
    const opps = computeStationOpportunities(["Nandos"])
    const nonBizWithLocal = opps.find(
      (o) =>
        (o.station.workplacePop1500m ?? 0) < 50_000 &&
        o.station.localIncomeDecile > 0,
    )
    if (nonBizWithLocal) {
      const demoSignal = nonBizWithLocal.brandGaps
        .flatMap((g) => g.signals)
        .find((s) => s.name === "demographic")
      expect(demoSignal?.rawValue).toContain("Local income decile")
      expect(demoSignal?.rawValue).toContain("1.5km")
    }
  })
})
