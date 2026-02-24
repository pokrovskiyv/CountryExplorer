import { describe, it, expect } from "vitest";
import { BRANDS, REGION_COUNTS, POPULATION } from "@/data/uk-data";

describe("CSV Export format", () => {
  const brands = Object.keys(BRANDS);

  it("should have correct number of data rows", () => {
    const regionCount = Object.keys(REGION_COUNTS).length;
    expect(regionCount).toBe(12);
  });

  it("should have population data for all regions", () => {
    Object.keys(REGION_COUNTS).forEach((region) => {
      expect(POPULATION[region]).toBeDefined();
      expect(POPULATION[region]).toBeGreaterThan(0);
    });
  });

  it("should have brand data for all regions", () => {
    Object.keys(REGION_COUNTS).forEach((region) => {
      const data = REGION_COUNTS[region];
      expect(data.total).toBeGreaterThan(0);
      brands.forEach((brand) => {
        expect(typeof data[brand]).toBe("number");
      });
    });
  });

  it("should calculate density correctly", () => {
    const region = "London";
    const data = REGION_COUNTS[region];
    const pop = POPULATION[region];
    const density = (data.total / pop) * 100;
    expect(density).toBeGreaterThan(0);
    expect(density).toBeLessThan(100);
  });
});
