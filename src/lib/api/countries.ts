import { supabase } from "@/integrations/supabase/client"
import type { CountryConfig, BrandInfo } from "@/contexts/CountryContext"

export async function fetchCountryConfig(code: string): Promise<Omit<CountryConfig, "brandPoints" | "interpolateColor">> {
  // Fetch country
  const { data: country, error: countryErr } = await supabase
    .from("countries")
    .select("*")
    .eq("code", code)
    .single()

  if (countryErr || !country) {
    throw new Error(`Country ${code} not found: ${countryErr?.message}`)
  }

  // Fetch regions
  const { data: regions, error: regionErr } = await supabase
    .from("regions")
    .select("*")
    .eq("country_code", code)

  if (regionErr || !regions) {
    throw new Error(`Failed to fetch regions: ${regionErr?.message}`)
  }

  // Fetch brands
  const { data: brands, error: brandErr } = await supabase
    .from("brands")
    .select("*")
    .eq("country_code", code)

  if (brandErr || !brands) {
    throw new Error(`Failed to fetch brands: ${brandErr?.message}`)
  }

  // Build brand ID → name map
  const brandIdToName = Object.fromEntries(brands.map((b) => [b.id, b.name]))

  // Fetch region-brand stats
  const regionIds = regions.map((r) => r.id)
  const { data: stats, error: statsErr } = await supabase
    .from("region_brand_stats")
    .select("*")
    .in("region_id", regionIds)

  if (statsErr) {
    throw new Error(`Failed to fetch stats: ${statsErr.message}`)
  }

  // Build region ID → name map
  const regionIdToName = Object.fromEntries(regions.map((r) => [r.id, r.name]))

  // Assemble brands record
  const brandsRecord: Record<string, BrandInfo> = {}
  for (const brand of brands) {
    brandsRecord[brand.name] = { color: brand.color, icon: brand.emoji }
  }

  // Assemble region counts
  const regionCounts: Record<string, Record<string, number>> = {}
  for (const region of regions) {
    regionCounts[region.name] = { total: 0 }
  }
  for (const stat of (stats || [])) {
    const regionName = regionIdToName[stat.region_id]
    const brandName = brandIdToName[stat.brand_id]
    if (regionName && brandName) {
      regionCounts[regionName][brandName] = stat.count
      regionCounts[regionName].total = (regionCounts[regionName].total || 0) + stat.count
    }
  }

  // Assemble population
  const population: Record<string, number> = {}
  for (const region of regions) {
    population[region.name] = region.population
  }

  // Assemble centroids
  const regionCentroids: Record<string, [number, number]> = {}
  for (const region of regions) {
    regionCentroids[region.name] = [region.centroid_lat, region.centroid_lng]
  }

  // City→region mapping not stored in DB — will be provided by static fallback
  const cityToRegion: Record<string, string> = {}

  return {
    code: country.code,
    name: country.name,
    brands: brandsRecord,
    regionCounts,
    population,
    regionCentroids,
    mapCenter: [country.map_center_lat, country.map_center_lng],
    mapZoom: country.map_zoom,
    cityToRegion,
  }
}
