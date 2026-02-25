import { describe, it, expect } from "vitest"
import {
  buildDeliverySnapshot,
  computeNationalStats,
  type RegionDeliveryStats,
} from "@/lib/delivery-aggregation"
import type { PointAttributes } from "@/data/brand-attributes"

// Helpers to build test data
function makePoint(city: string): [number, number, string, string, string] {
  return [51.5, -0.1, "Test Address", city, "SW1A 1AA"]
}

function makeAttrs(overrides: Partial<{
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

const cityToRegion: Record<string, string> = {
  London: "London",
  Manchester: "North West (England)",
  Cardiff: "Wales",
}

describe("delivery-aggregation", () => {
  describe("buildDeliverySnapshot", () => {
    it("aggregates attributes by region and brand", () => {
      const brandPoints = {
        KFC: [makePoint("London"), makePoint("London"), makePoint("Manchester")],
      }
      const brandAttributes = {
        KFC: [
          makeAttrs({ deliveroo: true, uberEats: true, driveThru: true }),
          makeAttrs({ deliveroo: true, uberEats: false, driveThru: false }),
          makeAttrs({ deliveroo: false, ownDelivery: true }),
        ],
      }

      const snapshot = buildDeliverySnapshot(brandPoints, brandAttributes, cityToRegion)

      const londonKFC = snapshot["London"]?.["KFC"]
      expect(londonKFC).toBeDefined()
      expect(londonKFC!.total).toBe(2)
      expect(londonKFC!.deliveroo).toBe(2)
      expect(londonKFC!.uberEats).toBe(1)
      expect(londonKFC!.driveThru).toBe(1)
      expect(londonKFC!.anyThirdParty).toBe(2) // both have deliveroo

      const nwKFC = snapshot["North West (England)"]?.["KFC"]
      expect(nwKFC).toBeDefined()
      expect(nwKFC!.total).toBe(1)
      expect(nwKFC!.ownDelivery).toBe(1)
      expect(nwKFC!.anyThirdParty).toBe(0)
    })

    it("handles multiple brands in the same region", () => {
      const brandPoints = {
        KFC: [makePoint("London")],
        McDonalds: [makePoint("London")],
      }
      const brandAttributes = {
        KFC: [makeAttrs({ deliveroo: true })],
        McDonalds: [makeAttrs({ uberEats: true, justEat: true })],
      }

      const snapshot = buildDeliverySnapshot(brandPoints, brandAttributes, cityToRegion)

      expect(snapshot["London"]?.["KFC"]?.deliveroo).toBe(1)
      expect(snapshot["London"]?.["McDonalds"]?.uberEats).toBe(1)
      expect(snapshot["London"]?.["McDonalds"]?.justEat).toBe(1)
    })

    it("skips points with unmapped cities", () => {
      const brandPoints = {
        KFC: [makePoint("UnknownCity")],
      }
      const brandAttributes = {
        KFC: [makeAttrs({ deliveroo: true })],
      }

      const snapshot = buildDeliverySnapshot(brandPoints, brandAttributes, cityToRegion)

      expect(Object.keys(snapshot)).toHaveLength(0)
    })

    it("returns empty snapshot for empty inputs", () => {
      const snapshot = buildDeliverySnapshot({}, {}, cityToRegion)
      expect(Object.keys(snapshot)).toHaveLength(0)
    })

    it("correctly computes anyThirdParty from multiple platforms", () => {
      const brandPoints = {
        KFC: [
          makePoint("London"),
          makePoint("London"),
          makePoint("London"),
        ],
      }
      const brandAttributes = {
        KFC: [
          makeAttrs({ deliveroo: true, uberEats: true, justEat: true }),
          makeAttrs({ deliveroo: false, uberEats: false, justEat: false }),
          makeAttrs({ deliveroo: false, uberEats: false, justEat: true }),
        ],
      }

      const snapshot = buildDeliverySnapshot(brandPoints, brandAttributes, cityToRegion)
      const stats = snapshot["London"]?.["KFC"]
      expect(stats!.anyThirdParty).toBe(2)
    })
  })

  describe("computeNationalStats", () => {
    it("sums stats across all regions for a brand", () => {
      const brandPoints = {
        KFC: [makePoint("London"), makePoint("Manchester"), makePoint("Cardiff")],
      }
      const brandAttributes = {
        KFC: [
          makeAttrs({ deliveroo: true, driveThru: true }),
          makeAttrs({ deliveroo: true, clickAndCollect: true }),
          makeAttrs({ ownDelivery: true }),
        ],
      }

      const snapshot = buildDeliverySnapshot(brandPoints, brandAttributes, cityToRegion)
      const national = computeNationalStats(snapshot, "KFC")

      expect(national.total).toBe(3)
      expect(national.deliveroo).toBe(2)
      expect(national.driveThru).toBe(1)
      expect(national.clickAndCollect).toBe(1)
      expect(national.ownDelivery).toBe(1)
    })

    it("returns empty stats for missing brand", () => {
      const snapshot = buildDeliverySnapshot({}, {}, cityToRegion)
      const national = computeNationalStats(snapshot, "NonExistent")

      expect(national.total).toBe(0)
      expect(national.deliveroo).toBe(0)
    })
  })
})
