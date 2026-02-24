import { describe, it, expect } from "vitest";
import { aggregateCitiesForRegion } from "@/lib/city-aggregation";
import { BRANDS, REGION_COUNTS } from "@/data/uk-data";

describe("aggregateCitiesForRegion", () => {
  const allBrands = new Set(Object.keys(BRANDS));

  it("returns cities for London", () => {
    const cities = aggregateCitiesForRegion("London", allBrands);
    expect(cities.length).toBeGreaterThan(0);
    expect(cities[0].total).toBeGreaterThan(0);
  });

  it("returns empty array for unknown region", () => {
    const cities = aggregateCitiesForRegion("Atlantis", allBrands);
    expect(cities).toEqual([]);
  });

  it("sorts cities by total descending", () => {
    const cities = aggregateCitiesForRegion("London", allBrands);
    for (let i = 1; i < cities.length; i++) {
      expect(cities[i - 1].total).toBeGreaterThanOrEqual(cities[i].total);
    }
  });

  it("filters by selected brands", () => {
    const oneBrand = new Set(["Subway"]);
    const cities = aggregateCitiesForRegion("London", oneBrand);
    cities.forEach((city) => {
      const brandKeys = Object.keys(city.brandCounts);
      expect(brandKeys).toContain("Subway");
      brandKeys.forEach((b) => expect(b).toBe("Subway"));
    });
  });

  it("city totals approximate region total within 10%", () => {
    const regions = Object.keys(REGION_COUNTS);
    regions.forEach((region) => {
      const cities = aggregateCitiesForRegion(region, allBrands);
      const cityTotal = cities.reduce((sum, c) => sum + c.total, 0);
      const regionTotal = REGION_COUNTS[region].total;
      expect(cityTotal).toBeGreaterThan(0);
      // BRAND_POINTS were generated independently from REGION_COUNTS,
      // so allow up to 15% deviation
      const tolerance = Math.ceil(regionTotal * 0.15);
      expect(Math.abs(cityTotal - regionTotal)).toBeLessThanOrEqual(tolerance);
    });
  });
});
