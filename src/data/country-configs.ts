// Country configuration builders
// Each country's static data assembled into a CountryConfig shape

import type { CountryConfig } from "@/contexts/CountryContext"
import { BRANDS, REGION_COUNTS, POPULATION, BRAND_POINTS, REGION_CENTROIDS, interpolateColor } from "./uk-data"
import { CITY_TO_REGION } from "./city-region-mapping"
import { DE_POPULATION, DE_REGION_COUNTS, DE_REGION_CENTROIDS, DE_CITY_TO_REGION, deInterpolateColor } from "./de-data"
import { DE_BRAND_POINTS } from "./de-brand-points"

// UK and DE share the same brand set
const SHARED_BRANDS = BRANDS

export const UK_CONFIG: CountryConfig = {
  code: "uk",
  name: "United Kingdom",
  brands: SHARED_BRANDS,
  regionCounts: REGION_COUNTS,
  population: POPULATION,
  brandPoints: BRAND_POINTS,
  regionCentroids: REGION_CENTROIDS,
  interpolateColor,
  mapCenter: [54.5, -2],
  mapZoom: 6,
  cityToRegion: CITY_TO_REGION,
}

export const DE_CONFIG: CountryConfig = {
  code: "de",
  name: "Germany",
  brands: SHARED_BRANDS,
  regionCounts: DE_REGION_COUNTS,
  population: DE_POPULATION,
  brandPoints: DE_BRAND_POINTS,
  regionCentroids: DE_REGION_CENTROIDS,
  interpolateColor: deInterpolateColor,
  mapCenter: [51.2, 10.4],
  mapZoom: 6,
  cityToRegion: DE_CITY_TO_REGION,
}

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  uk: UK_CONFIG,
  de: DE_CONFIG,
}
