import { useCountry } from "@/contexts/CountryContext";
import type { CityBrandData } from "@/lib/city-aggregation";

interface CityBreakdownProps {
  readonly cities: readonly CityBrandData[];
  readonly selectedBrands: ReadonlySet<string>;
}

const CityBreakdown = ({ cities, selectedBrands }: CityBreakdownProps) => {
  const { brands: BRANDS } = useCountry();

  if (cities.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        No city data available for this region.
      </p>
    );
  }

  const maxTotal = Math.max(...cities.map((c) => c.total));
  const brands = [...selectedBrands];

  return (
    <div className="space-y-1.5">
      {cities.map(({ city, brandCounts, total }) => (
        <div key={city} className="group">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs text-slate-300 font-medium">{city}</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {total}
            </span>
          </div>
          <div className="flex h-4 bg-[hsl(230,25%,13%)] rounded overflow-hidden">
            {brands.map((brand) => {
              const count = brandCounts[brand] || 0;
              if (count === 0) return null;
              const width = (count / maxTotal) * 100;
              return (
                <div
                  key={brand}
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${width}%`,
                    backgroundColor: BRANDS[brand]?.color || "#666",
                  }}
                  title={`${brand}: ${count}`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CityBreakdown;
