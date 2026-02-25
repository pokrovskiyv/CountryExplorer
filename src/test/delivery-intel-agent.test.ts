import { describe, it, expect } from "vitest"
import { runDeliveryIntel } from "@/lib/delivery-intel-agent"
import type { CountryConfig } from "@/contexts/CountryContext"
import type { PointAttributes } from "@/data/brand-attributes"

// Minimal config builder for testing
function makeConfig(overrides: {
  brands?: string[]
  points?: Record<string, [number, number, string, string, string][]>
  attrs?: Record<string, PointAttributes[]>
  cityToRegion?: Record<string, string>
}): CountryConfig {
  const brands = overrides.brands ?? ["BrandA", "BrandB"]
  return {
    code: "test",
    name: "Test",
    brands: Object.fromEntries(brands.map((b) => [b, { color: "#000", icon: "X" }])),
    regionCounts: {},
    population: {},
    brandPoints: overrides.points ?? {},
    regionCentroids: {},
    interpolateColor: () => "#000",
    mapCenter: [0, 0],
    mapZoom: 5,
    cityToRegion: overrides.cityToRegion ?? { London: "London", Manchester: "North West" },
    brandAttributes: overrides.attrs ?? {},
  }
}

function pt(city: string): [number, number, string, string, string] {
  return [51.5, -0.1, "Addr", city, "SW1"]
}

function attrs(overrides: Partial<{
  deliveroo: boolean
  uberEats: boolean
  justEat: boolean
  ownDelivery: boolean
  driveThru: boolean
  clickAndCollect: boolean
}>): PointAttributes {
  return {
    delivery: {
      deliveroo: overrides.deliveroo ?? false,
      uberEats: overrides.uberEats ?? false,
      justEat: overrides.justEat ?? false,
      ownDelivery: overrides.ownDelivery ?? false,
    },
    driveThru: overrides.driveThru ?? false,
    clickAndCollect: overrides.clickAndCollect ?? false,
  }
}

// Repeat a value N times into an array
function repeat<T>(n: number, val: T): T[] {
  return Array.from({ length: n }, () => val)
}

describe("delivery-intel-agent", () => {
  it("returns empty when no brandAttributes", () => {
    const config = makeConfig({})
    const configNoBrandAttrs = { ...config, brandAttributes: undefined }
    expect(runDeliveryIntel(configNoBrandAttrs)).toEqual([])
  })

  it("detects platform-coverage-gap when brands differ by >20pp", () => {
    // BrandA: 9/10 on Deliveroo (90%), BrandB: 3/10 (30%) → 60pp gap
    const config = makeConfig({
      brands: ["BrandA", "BrandB"],
      points: {
        BrandA: repeat(10, pt("London")),
        BrandB: repeat(10, pt("London")),
      },
      attrs: {
        BrandA: [
          ...repeat(9, attrs({ deliveroo: true })),
          attrs({}),
        ],
        BrandB: [
          ...repeat(3, attrs({ deliveroo: true })),
          ...repeat(7, attrs({})),
        ],
      },
    })

    const insights = runDeliveryIntel(config)
    const gaps = insights.filter((i) => i.insightType === "platform-coverage-gap")
    expect(gaps.length).toBeGreaterThanOrEqual(1)
    expect(gaps[0].message).toContain("Deliveroo")
    expect(gaps[0].brands).toContain("BrandA")
  })

  it("detects delivery-desert when third-party penetration <30%", () => {
    // All 20 points with no third-party delivery → 0% penetration
    const config = makeConfig({
      brands: ["BrandA"],
      points: { BrandA: repeat(20, pt("London")) },
      attrs: { BrandA: repeat(20, attrs({ ownDelivery: true })) },
    })

    const insights = runDeliveryIntel(config)
    const deserts = insights.filter((i) => i.insightType === "delivery-desert")
    expect(deserts.length).toBeGreaterThanOrEqual(1)
    expect(deserts[0].message).toContain("London")
    expect(deserts[0].priority).toBe(1)
  })

  it("does not fire delivery-desert when penetration >=30%", () => {
    // 5/10 on third-party = 50%
    const config = makeConfig({
      brands: ["BrandA"],
      points: { BrandA: repeat(10, pt("London")) },
      attrs: {
        BrandA: [
          ...repeat(5, attrs({ deliveroo: true })),
          ...repeat(5, attrs({})),
        ],
      },
    })

    const insights = runDeliveryIntel(config)
    const deserts = insights.filter((i) => i.insightType === "delivery-desert")
    expect(deserts).toHaveLength(0)
  })

  it("detects drive-thru-advantage when gap >25pp", () => {
    // BrandA: 8/10 drive-thru (80%), BrandB: 2/10 (20%) → 60pp gap
    const config = makeConfig({
      brands: ["BrandA", "BrandB"],
      points: {
        BrandA: repeat(10, pt("London")),
        BrandB: repeat(10, pt("London")),
      },
      attrs: {
        BrandA: [
          ...repeat(8, attrs({ driveThru: true })),
          ...repeat(2, attrs({})),
        ],
        BrandB: [
          ...repeat(2, attrs({ driveThru: true })),
          ...repeat(8, attrs({})),
        ],
      },
    })

    const insights = runDeliveryIntel(config)
    const dt = insights.filter((i) => i.insightType === "drive-thru-advantage")
    expect(dt.length).toBeGreaterThanOrEqual(1)
    expect(dt[0].message).toContain("drive-thru")
  })

  it("detects own-delivery-dominance for brand >80% own, <10% aggregator", () => {
    // BrandA: all 20 with ownDelivery, none on aggregators
    const config = makeConfig({
      brands: ["BrandA"],
      points: { BrandA: repeat(20, pt("London")) },
      attrs: { BrandA: repeat(20, attrs({ ownDelivery: true })) },
    })

    const insights = runDeliveryIntel(config)
    const own = insights.filter((i) => i.insightType === "own-delivery-dominance")
    expect(own.length).toBeGreaterThanOrEqual(1)
    expect(own[0].message).toContain("own delivery")
    expect(own[0].region).toBe("National")
  })

  it("detects click-collect-leader when brand >90% in region", () => {
    // BrandA: 10/10 click & collect (100%)
    const config = makeConfig({
      brands: ["BrandA"],
      points: { BrandA: repeat(10, pt("London")) },
      attrs: { BrandA: repeat(10, attrs({ clickAndCollect: true })) },
    })

    const insights = runDeliveryIntel(config)
    const cc = insights.filter((i) => i.insightType === "click-collect-leader")
    expect(cc.length).toBeGreaterThanOrEqual(1)
    expect(cc[0].message).toContain("Click & Collect")
    expect(cc[0].message).toContain("BrandA")
  })

  it("insights are sorted by priority", () => {
    const config = makeConfig({
      brands: ["BrandA", "BrandB"],
      points: {
        BrandA: repeat(20, pt("London")),
        BrandB: repeat(20, pt("London")),
      },
      attrs: {
        BrandA: repeat(20, attrs({ ownDelivery: true, driveThru: true, clickAndCollect: true })),
        BrandB: repeat(20, attrs({})),
      },
    })

    const insights = runDeliveryIntel(config)
    for (let i = 1; i < insights.length; i++) {
      expect(insights[i].priority).toBeGreaterThanOrEqual(insights[i - 1].priority)
    }
  })

  it("all insights have agentId delivery-intel", () => {
    const config = makeConfig({
      brands: ["BrandA"],
      points: { BrandA: repeat(20, pt("London")) },
      attrs: { BrandA: repeat(20, attrs({ ownDelivery: true, clickAndCollect: true })) },
    })

    const insights = runDeliveryIntel(config)
    for (const insight of insights) {
      expect(insight.agentId).toBe("delivery-intel")
    }
  })
})
