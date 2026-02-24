import { BRAND_POINTS } from "@/data/brand-points";
import { CITY_TO_REGION } from "@/data/city-region-mapping";

export interface CityBrandData {
  readonly city: string;
  readonly brandCounts: Readonly<Record<string, number>>;
  readonly total: number;
}

export function aggregateCitiesForRegion(
  region: string,
  selectedBrands: ReadonlySet<string>
): readonly CityBrandData[] {
  const cityMap = new Map<string, Record<string, number>>();

  for (const brand of selectedBrands) {
    const points = BRAND_POINTS[brand] || [];
    for (const point of points) {
      const city = point[3];
      const cityRegion = CITY_TO_REGION[city];
      if (cityRegion !== region) continue;

      if (!cityMap.has(city)) {
        cityMap.set(city, {});
      }
      const counts = cityMap.get(city)!;
      counts[brand] = (counts[brand] || 0) + 1;
    }
  }

  return [...cityMap.entries()]
    .map(([city, brandCounts]) => ({
      city,
      brandCounts,
      total: Object.values(brandCounts).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);
}
