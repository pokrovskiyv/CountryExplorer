import { describe, it, expect } from "vitest";
import { aggregateCitiesForRegion } from "@/lib/city-aggregation";
import { BRANDS, REGION_COUNTS, BRAND_POINTS } from "@/data/uk-data";
import { CITY_TO_REGION } from "@/data/city-region-mapping";

describe("aggregateCitiesForRegion", () => {
  const allBrands = new Set(Object.keys(BRANDS));

  it("returns cities for London", () => {
    const cities = aggregateCitiesForRegion("London", allBrands, BRAND_POINTS, CITY_TO_REGION);
    expect(cities.length).toBeGreaterThan(0);
    expect(cities[0].total).toBeGreaterThan(0);
  });

  it("returns empty array for unknown region", () => {
    const cities = aggregateCitiesForRegion("Atlantis", allBrands, BRAND_POINTS, CITY_TO_REGION);
    expect(cities).toEqual([]);
  });

  it("sorts cities by total descending", () => {
    const cities = aggregateCitiesForRegion("London", allBrands, BRAND_POINTS, CITY_TO_REGION);
    for (let i = 1; i < cities.length; i++) {
      expect(cities[i - 1].total).toBeGreaterThanOrEqual(cities[i].total);
    }
  });

  it("filters by selected brands", () => {
    const oneBrand = new Set(["Subway"]);
    const cities = aggregateCitiesForRegion("London", oneBrand, BRAND_POINTS, CITY_TO_REGION);
    cities.forEach((city) => {
      const brandKeys = Object.keys(city.brandCounts);
      expect(brandKeys).toContain("Subway");
      brandKeys.forEach((b) => expect(b).toBe("Subway"));
    });
  });

  it("city totals approximate region total within 15%", () => {
    const regions = Object.keys(REGION_COUNTS);
    regions.forEach((region) => {
      const cities = aggregateCitiesForRegion(region, allBrands, BRAND_POINTS, CITY_TO_REGION);
      const cityTotal = cities.reduce((sum, c) => sum + c.total, 0);
      const regionTotal = REGION_COUNTS[region].total;
      expect(cityTotal).toBeGreaterThan(0);
      const tolerance = Math.ceil(regionTotal * 0.15);
      expect(Math.abs(cityTotal - regionTotal)).toBeLessThanOrEqual(tolerance);
    });
  });
});
