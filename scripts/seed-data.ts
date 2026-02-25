/**
 * Seed script: reads static data files and upserts into Supabase
 * Usage: npx tsx scripts/seed-data.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.
 */

import { createClient } from "@supabase/supabase-js"
import { UK_CONFIG } from "../src/data/country-configs"
import type { CountryConfig } from "../src/contexts/CountryContext"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function seedCountry(config: CountryConfig) {
  const { code, name, brands, regionCounts, population, brandPoints, regionCentroids, mapCenter, mapZoom } = config

  console.log(`\nSeeding ${name} (${code})...`)

  // Upsert country
  const { error: countryErr } = await supabase
    .from("countries")
    .upsert({ code, name, map_center_lat: mapCenter[0], map_center_lng: mapCenter[1], map_zoom: mapZoom })
  if (countryErr) throw new Error(`Country upsert failed: ${countryErr.message}`)
  console.log("  Country upserted")

  // Upsert regions
  const regionRows = Object.entries(population).map(([regionName, pop]) => ({
    id: `${code}-${regionName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    country_code: code,
    name: regionName,
    population: pop,
    centroid_lat: regionCentroids[regionName]?.[0] || 0,
    centroid_lng: regionCentroids[regionName]?.[1] || 0,
  }))

  const { error: regionErr } = await supabase.from("regions").upsert(regionRows)
  if (regionErr) throw new Error(`Region upsert failed: ${regionErr.message}`)
  console.log(`  ${regionRows.length} regions upserted`)

  // Build region ID map
  const regionIdMap = Object.fromEntries(regionRows.map((r) => [r.name, r.id]))

  // Upsert brands
  const brandRows = Object.entries(brands).map(([brandName, info]) => ({
    id: `${code}-${brandName.toLowerCase()}`,
    country_code: code,
    name: brandName,
    color: info.color,
    emoji: info.icon,
  }))

  const { error: brandErr } = await supabase.from("brands").upsert(brandRows)
  if (brandErr) throw new Error(`Brand upsert failed: ${brandErr.message}`)
  console.log(`  ${brandRows.length} brands upserted`)

  // Build brand ID map
  const brandIdMap = Object.fromEntries(brandRows.map((b) => [b.name, b.id]))

  // Upsert region_brand_stats
  const statsRows: { region_id: string; brand_id: string; count: number }[] = []
  for (const [regionName, counts] of Object.entries(regionCounts)) {
    for (const [brandName] of Object.entries(brands)) {
      statsRows.push({
        region_id: regionIdMap[regionName],
        brand_id: brandIdMap[brandName],
        count: counts[brandName] || 0,
      })
    }
  }

  // Batch upsert stats in chunks of 500
  for (let i = 0; i < statsRows.length; i += 500) {
    const chunk = statsRows.slice(i, i + 500)
    const { error } = await supabase.from("region_brand_stats").upsert(chunk)
    if (error) throw new Error(`Stats upsert failed: ${error.message}`)
  }
  console.log(`  ${statsRows.length} stats upserted`)

  // Upsert locations in batches of 1000
  let locationCount = 0
  for (const [brandName, points] of Object.entries(brandPoints)) {
    const brandId = brandIdMap[brandName]

    for (let i = 0; i < points.length; i += 1000) {
      const batch = points.slice(i, i + 1000).map((p) => ({
        brand_id: brandId,
        region_id: regionIdMap[config.cityToRegion[p[3]] || ""] || regionRows[0].id,
        lat: p[0],
        lng: p[1],
        address: p[2],
        city: p[3],
        postcode: p[4],
      }))

      const { error } = await supabase.from("locations").upsert(batch, { onConflict: "id" })
      if (error) throw new Error(`Location upsert failed: ${error.message}`)
      locationCount += batch.length
    }
  }
  console.log(`  ${locationCount} locations upserted`)
}

async function main() {
  console.log("Starting data seed...")

  await seedCountry(UK_CONFIG)

  console.log("\nSeed complete!")
}

main().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
