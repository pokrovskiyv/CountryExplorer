import { describe, it, expect } from "vitest"
import { OPEN_DATES } from "@/data/temporal-data"
import { getVisibleIndicesForMonth } from "@/hooks/useTimeline"
import { BRAND_POINTS } from "@/data/brand-points"

describe("temporal-data", () => {
  it("generates dates for every brand point", () => {
    for (const brand of Object.keys(BRAND_POINTS)) {
      expect(OPEN_DATES[brand]).toBeDefined()
      expect(OPEN_DATES[brand].length).toBe(BRAND_POINTS[brand].length)
    }
  })

  it("all dates fall within 2015–2025 range", () => {
    const minDate = new Date(2015, 0, 1)
    const maxDate = new Date(2025, 11, 1)
    for (const brand of Object.keys(OPEN_DATES)) {
      for (const date of OPEN_DATES[brand]) {
        expect(date.getTime()).toBeGreaterThanOrEqual(minDate.getTime())
        expect(date.getTime()).toBeLessThanOrEqual(maxDate.getTime())
      }
    }
  })
})

describe("getVisibleIndicesForMonth", () => {
  it("returns all points visible at max month (Dec 2025)", () => {
    const indices = getVisibleIndicesForMonth(131)
    for (const brand of Object.keys(BRAND_POINTS)) {
      expect(indices[brand].size).toBe(BRAND_POINTS[brand].length)
    }
  })

  it("returns no points before any opened (month -1)", () => {
    // Month -1 doesn't exist but we can test month 0 with a special case:
    // At month 0 (Jan 2015) some early Subway points may already be open.
    // Instead, build a test with custom dates where nothing is open yet.
    const testDates: Record<string, readonly Date[]> = {
      TestBrand: [new Date(2016, 0, 1), new Date(2017, 0, 1)],
    }
    // Month 0 = Jan 2015, which is before Jan 2016
    const indices = getVisibleIndicesForMonth(0, testDates)
    expect(indices["TestBrand"].size).toBe(0)
  })

  it("visible count increases monotonically as months advance", () => {
    let prevTotal = 0
    for (let month = 0; month <= 131; month += 6) {
      const indices = getVisibleIndicesForMonth(month)
      let total = 0
      for (const brand of Object.keys(indices)) {
        total += indices[brand].size
      }
      expect(total).toBeGreaterThanOrEqual(prevTotal)
      prevTotal = total
    }
  })

  it("filters per-brand correctly with custom dates", () => {
    const testDates: Record<string, readonly Date[]> = {
      BrandA: [new Date(2015, 0, 1), new Date(2018, 6, 1), new Date(2022, 0, 1)],
      BrandB: [new Date(2020, 0, 1)],
    }
    // Month 42 = Jul 2018 (2015 + 42/12 = 2018, 42%12 = 6 = Jul)
    const indices = getVisibleIndicesForMonth(42, testDates)
    expect(indices["BrandA"].size).toBe(2) // Jan 2015 and Jul 2018
    expect(indices["BrandB"].size).toBe(0) // Jan 2020 is in the future
  })

  it("Subway has more early points than PapaJohns", () => {
    // At month 24 (Jan 2017), Subway should have more open locations
    const indices = getVisibleIndicesForMonth(24)
    expect(indices["Subway"].size).toBeGreaterThan(indices["PapaJohns"].size)
  })
})
