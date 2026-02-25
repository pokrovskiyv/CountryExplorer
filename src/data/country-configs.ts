// Country configuration builders
// Each country's static data assembled into a CountryConfig shape

import type { CountryConfig } from "@/contexts/CountryContext"
import { BRANDS, REGION_COUNTS, POPULATION, BRAND_POINTS, REGION_CENTROIDS, interpolateColor } from "./uk-data"
import { CITY_TO_REGION } from "./city-region-mapping"

export const UK_CONFIG: CountryConfig = {
  code: "uk",
  name: "United Kingdom",
  brands: BRANDS,
  regionCounts: REGION_COUNTS,
  population: POPULATION,
  brandPoints: BRAND_POINTS,
  regionCentroids: REGION_CENTROIDS,
  interpolateColor,
  mapCenter: [54.5, -2],
  mapZoom: 6,
  cityToRegion: CITY_TO_REGION,
}

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  uk: UK_CONFIG,
}
