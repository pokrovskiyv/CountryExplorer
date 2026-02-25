import { describe, it, expect } from "vitest";
import { COUNTRY_CONFIGS } from "@/data/country-configs";
import type { CountryConfig } from "@/contexts/CountryContext";

function validateConfig(config: CountryConfig) {
  const regionNames = Object.keys(config.regionCounts);

  // All required fields present
  expect(config.code).toBeTruthy();
  expect(config.name).toBeTruthy();
  expect(Object.keys(config.brands).length).toBeGreaterThan(0);
  expect(regionNames.length).toBeGreaterThan(0);
  expect(config.mapCenter).toHaveLength(2);
  expect(config.mapZoom).toBeGreaterThan(0);

  // Population for every region
  regionNames.forEach((region) => {
    expect(config.population[region]).toBeDefined();
    expect(config.population[region]).toBeGreaterThan(0);
  });

  // Region counts have all brands + total
  const brandNames = Object.keys(config.brands);
  regionNames.forEach((region) => {
    const counts = config.regionCounts[region];
    expect(counts.total).toBeGreaterThan(0);
    brandNames.forEach((brand) => {
      expect(typeof counts[brand]).toBe("number");
    });
  });

  // Region counts totals are consistent
  regionNames.forEach((region) => {
    const counts = config.regionCounts[region];
    const sum = brandNames.reduce((acc, b) => acc + (counts[b] || 0), 0);
    expect(counts.total).toBe(sum);
  });

  // Brand points exist for all brands
  brandNames.forEach((brand) => {
    expect(config.brandPoints[brand]).toBeDefined();
    expect(config.brandPoints[brand].length).toBeGreaterThan(0);
  });

  // Centroids for every region
  regionNames.forEach((region) => {
    expect(config.regionCentroids[region]).toBeDefined();
    expect(config.regionCentroids[region]).toHaveLength(2);
  });

  // interpolateColor works
  expect(config.interpolateColor(0)).toMatch(/^rgb\(/);
  expect(config.interpolateColor(1)).toMatch(/^rgb\(/);
}

describe("Country Configs", () => {
  it("UK config has all required fields and consistent data", () => {
    validateConfig(COUNTRY_CONFIGS.uk);
  });

  it("UK has 12 regions", () => {
    expect(Object.keys(COUNTRY_CONFIGS.uk.regionCounts).length).toBe(12);
  });

  it("DE config has all required fields and consistent data", () => {
    validateConfig(COUNTRY_CONFIGS.de);
  });

  it("DE has 16 regions", () => {
    expect(Object.keys(COUNTRY_CONFIGS.de.regionCounts).length).toBe(16);
  });

  it("both countries share the same brand set", () => {
    const ukBrands = Object.keys(COUNTRY_CONFIGS.uk.brands).sort();
    const deBrands = Object.keys(COUNTRY_CONFIGS.de.brands).sort();
    expect(ukBrands).toEqual(deBrands);
  });
});
