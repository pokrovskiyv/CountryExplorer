import { supabase } from "@/integrations/supabase/client"

export type BrandPoints = Record<string, readonly [number, number, string, string, string][]>

const PAGE_SIZE = 1000

export async function fetchBrandPoints(code: string): Promise<BrandPoints> {
  // Fetch all brands for this country to build ID→name map
  const { data: brands, error: brandErr } = await supabase
    .from("brands")
    .select("id, name")
    .eq("country_code", code)

  if (brandErr || !brands) {
    throw new Error(`Failed to fetch brands: ${brandErr?.message}`)
  }

  const brandIdToName = Object.fromEntries(brands.map((b) => [b.id, b.name]))

  // Initialize result with empty arrays for each brand
  const result: Record<string, [number, number, string, string, string][]> = {}
  for (const brand of brands) {
    result[brand.name] = []
  }

  // Fetch all regions for this country to get region IDs
  const { data: regions, error: regionErr } = await supabase
    .from("regions")
    .select("id")
    .eq("country_code", code)

  if (regionErr || !regions) {
    throw new Error(`Failed to fetch regions: ${regionErr?.message}`)
  }

  const regionIds = regions.map((r) => r.id)

  // Paginate through locations
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data: locations, error: locErr } = await supabase
      .from("locations")
      .select("lat, lng, address, city, postcode, brand_id")
      .in("region_id", regionIds)
      .range(offset, offset + PAGE_SIZE - 1)

    if (locErr) {
      throw new Error(`Failed to fetch locations: ${locErr.message}`)
    }

    if (!locations || locations.length === 0) {
      hasMore = false
      break
    }

    for (const loc of locations) {
      const brandName = brandIdToName[loc.brand_id]
      if (brandName && result[brandName]) {
        result[brandName].push([
          loc.lat,
          loc.lng,
          loc.address || "",
          loc.city || "",
          loc.postcode || "",
        ])
      }
    }

    if (locations.length < PAGE_SIZE) {
      hasMore = false
    } else {
      offset += PAGE_SIZE
    }
  }

  return result
}
