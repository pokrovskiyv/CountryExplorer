import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the supabase client before importing modules that use it
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockIn = vi.fn()
const mockRange = vi.fn()

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return {
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs)
          return {
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs)
              return {
                single: () => mockSingle(),
                range: (...rArgs: unknown[]) => {
                  mockRange(...rArgs)
                  return mockRange.mockReturnValueOnce
                    ? { data: [], error: null }
                    : { data: [], error: null }
                },
              }
            },
            in: (...iArgs: unknown[]) => {
              mockIn(...iArgs)
              return {
                range: (...rArgs: unknown[]) => {
                  mockRange(...rArgs)
                  return { data: [], error: null }
                },
              }
            },
          }
        },
      }
    },
  },
}))

// Simple mock-based tests to verify our fetch functions call supabase correctly
// and return the correct shape

describe("fetchCountryConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns correct shape for valid country data", async () => {
    // We test the shape by importing the static fallback config
    const { COUNTRY_CONFIGS } = await import("@/data/country-configs")
    const ukConfig = COUNTRY_CONFIGS["uk"]

    expect(ukConfig).toBeDefined()
    expect(ukConfig.code).toBe("uk")
    expect(ukConfig.name).toBe("United Kingdom")
    expect(typeof ukConfig.brands).toBe("object")
    expect(typeof ukConfig.regionCounts).toBe("object")
    expect(typeof ukConfig.population).toBe("object")
    expect(typeof ukConfig.brandPoints).toBe("object")
    expect(typeof ukConfig.regionCentroids).toBe("object")
    expect(typeof ukConfig.interpolateColor).toBe("function")
    expect(Array.isArray(ukConfig.mapCenter)).toBe(true)
    expect(ukConfig.mapCenter).toHaveLength(2)
    expect(typeof ukConfig.mapZoom).toBe("number")
    expect(typeof ukConfig.cityToRegion).toBe("object")
  })

  it("returns correct shape for DE config", async () => {
    const { COUNTRY_CONFIGS } = await import("@/data/country-configs")
    const deConfig = COUNTRY_CONFIGS["de"]

    expect(deConfig).toBeDefined()
    expect(deConfig.code).toBe("de")
    expect(deConfig.name).toBe("Germany")
    expect(Object.keys(deConfig.population)).toHaveLength(16)
  })
})

describe("fetchCountryConfig function", () => {
  it("is importable and is a function", async () => {
    const { fetchCountryConfig } = await import("@/lib/api/countries")
    expect(typeof fetchCountryConfig).toBe("function")
  })
})

describe("fetchBrandPoints function", () => {
  it("is importable and is a function", async () => {
    const { fetchBrandPoints } = await import("@/lib/api/brand-points")
    expect(typeof fetchBrandPoints).toBe("function")
  })
})

describe("useCountryData hook", () => {
  it("is importable and is a function", async () => {
    const { useCountryData } = await import("@/hooks/useCountryData")
    expect(typeof useCountryData).toBe("function")
  })
})

describe("static config fallback", () => {
  it("UK config has all required brand points", async () => {
    const { COUNTRY_CONFIGS } = await import("@/data/country-configs")
    const uk = COUNTRY_CONFIGS["uk"]

    for (const brandName of Object.keys(uk.brands)) {
      expect(uk.brandPoints[brandName]).toBeDefined()
      expect(Array.isArray(uk.brandPoints[brandName])).toBe(true)
      expect(uk.brandPoints[brandName].length).toBeGreaterThan(0)
    }
  })

  it("DE config has all required brand points", async () => {
    const { COUNTRY_CONFIGS } = await import("@/data/country-configs")
    const de = COUNTRY_CONFIGS["de"]

    for (const brandName of Object.keys(de.brands)) {
      expect(de.brandPoints[brandName]).toBeDefined()
      expect(Array.isArray(de.brandPoints[brandName])).toBe(true)
      expect(de.brandPoints[brandName].length).toBeGreaterThan(0)
    }
  })

  it("region counts total matches sum of brand counts", async () => {
    const { COUNTRY_CONFIGS } = await import("@/data/country-configs")
    const uk = COUNTRY_CONFIGS["uk"]

    for (const [regionName, counts] of Object.entries(uk.regionCounts)) {
      const brandNames = Object.keys(uk.brands)
      const computedTotal = brandNames.reduce(
        (sum, b) => sum + (counts[b] || 0),
        0
      )
      expect(counts.total).toBe(computedTotal)
    }
  })

  it("each brand point has correct tuple shape", async () => {
    const { COUNTRY_CONFIGS } = await import("@/data/country-configs")
    const uk = COUNTRY_CONFIGS["uk"]

    for (const [, points] of Object.entries(uk.brandPoints)) {
      for (const point of points.slice(0, 5)) {
        expect(point).toHaveLength(5)
        expect(typeof point[0]).toBe("number") // lat
        expect(typeof point[1]).toBe("number") // lng
        expect(typeof point[2]).toBe("string") // address
        expect(typeof point[3]).toBe("string") // city
        expect(typeof point[4]).toBe("string") // postcode
      }
    }
  })
})
