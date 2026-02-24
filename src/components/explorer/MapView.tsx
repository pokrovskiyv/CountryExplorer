import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as topojson from "topojson-client";
import { BRANDS, REGION_COUNTS, POPULATION, BRAND_POINTS, interpolateColor } from "@/data/uk-data";

type Metric = "total" | "density" | "share";
type Display = "choropleth" | "points" | "both";

interface MapViewProps {
  selectedBrands: Set<string>;
  metric: Metric;
  display: Display;
  selectedRegion: string | null;
  onRegionSelect: (name: string) => void;
  topoData: any;
}

const MapView = ({ selectedBrands, metric, display, selectedRegion, onRegionSelect, topoData }: MapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const regionLayerRef = useRef<L.GeoJSON | null>(null);
  const pointLayersRef = useRef<Record<string, L.LayerGroup>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const getMetricValue = useCallback((props: any) => {
    if (metric === "total") {
      let sum = 0;
      selectedBrands.forEach((b) => { sum += props[b] || 0; });
      return sum;
    } else if (metric === "density") {
      let sum = 0;
      selectedBrands.forEach((b) => { sum += props[b] || 0; });
      const pop = POPULATION[props.name] || 1;
      return (sum / pop) * 100;
    } else {
      const brand = [...selectedBrands][0];
      if (!brand) return 0;
      const total = props.total || 1;
      return ((props[brand] || 0) / total) * 100;
    }
  }, [selectedBrands, metric]);

  const getMaxMetric = useCallback(() => {
    if (!topoData) return 0;
    let max = 0;
    const geojson = topojson.feature(topoData, Object.values(topoData.objects)[0] as any) as any;
    geojson.features.forEach((f: any) => {
      const v = getMetricValue(f.properties);
      if (v > max) max = v;
    });
    return max;
  }, [topoData, getMetricValue]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([54.5, -2], 6);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png", {
      subdomains: "abcd",
      maxZoom: 18,
    }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png", {
      subdomains: "abcd",
      maxZoom: 18,
      pane: "shadowPane",
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add/update region layer when topoData loads
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !topoData) return;

    if (regionLayerRef.current) {
      map.removeLayer(regionLayerRef.current);
    }

    const geojson = topojson.feature(topoData, Object.values(topoData.objects)[0] as any) as any;
    const maxVal = getMaxMetric();

    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        if (!feature) return {};
        const val = getMetricValue(feature.properties);
        const intensity = maxVal > 0 ? val / maxVal : 0;
        return {
          fillColor: interpolateColor(intensity),
          weight: 1.5,
          color: "#3a3f52",
          fillOpacity: display === "points" ? 0.15 : 0.7,
        };
      },
      onEachFeature: (feature, lyr) => {
        lyr.on({
          mouseover: (e) => {
            const target = e.target;
            target.setStyle({ weight: 2.5, color: "#60a5fa" });
            target.bringToFront();

            if (tooltipRef.current && containerRef.current) {
              const props = feature.properties;
              let html = `<div class="font-semibold text-[13px] text-white mb-1">${props.name}</div>`;
              Object.keys(BRANDS).forEach((b) => {
                if (selectedBrands.has(b)) {
                  html += `<div class="flex items-center gap-1.5 py-0.5"><span class="w-2 h-2 rounded-full inline-block" style="background:${BRANDS[b].color}"></span>${b}: <strong>${props[b] || 0}</strong></div>`;
                }
              });
              const total = getMetricValue(props);
              const label = metric === "density" ? " per 100k" : metric === "share" ? "%" : " total";
              html += `<div class="mt-1 pt-1 border-t border-border font-semibold">Metric: ${total.toFixed(metric === "total" ? 0 : 1)}${label}</div>`;
              tooltipRef.current.innerHTML = html;
              tooltipRef.current.style.display = "block";

              const mapRect = containerRef.current.getBoundingClientRect();
              tooltipRef.current.style.left = (e.originalEvent.clientX - mapRect.left + 12) + "px";
              tooltipRef.current.style.top = (e.originalEvent.clientY - mapRect.top - 12) + "px";
            }
          },
          mouseout: (e) => {
            layer.resetStyle(e.target);
            if (selectedRegion && feature.properties.name === selectedRegion) {
              e.target.setStyle({ weight: 3, color: "#60a5fa" });
            }
            if (tooltipRef.current) tooltipRef.current.style.display = "none";
          },
          click: () => {
            onRegionSelect(feature.properties.name);
          },
        });
      },
    }).addTo(map);

    regionLayerRef.current = layer;
  }, [topoData, selectedBrands, metric, display, selectedRegion, getMetricValue, getMaxMetric, onRegionSelect]);

  // Highlight selected region
  useEffect(() => {
    if (!regionLayerRef.current) return;
    regionLayerRef.current.eachLayer((l: any) => {
      regionLayerRef.current!.resetStyle(l);
      if (selectedRegion && l.feature?.properties.name === selectedRegion) {
        l.setStyle({ weight: 3, color: "#60a5fa" });
      }
    });
  }, [selectedRegion]);

  // Update points
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(pointLayersRef.current).forEach((lg) => map.removeLayer(lg));
    pointLayersRef.current = {};

    if (display === "points" || display === "both") {
      selectedBrands.forEach((brand) => {
        const pts = BRAND_POINTS[brand] || [];
        const markers = pts.map((p) =>
          L.circleMarker([p[0], p[1]], {
            radius: 4,
            fillColor: BRANDS[brand].color,
            color: "transparent",
            fillOpacity: 0.85,
          }).bindPopup(`<b>${brand}</b><br>${p[2]}<br>${p[3]} ${p[4]}`)
        );
        pointLayersRef.current[brand] = L.layerGroup(markers).addTo(map);
      });
    }
  }, [selectedBrands, display]);

  // Fit bounds on selected region
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedRegion || !regionLayerRef.current) return;
    regionLayerRef.current.eachLayer((l: any) => {
      if (l.feature?.properties.name === selectedRegion) {
        map.fitBounds(l.getBounds(), { padding: [50, 50] });
      }
    });
  }, [selectedRegion]);

  // Legend
  const maxMetric = getMaxMetric();
  const legendLabel = metric === "total" ? "Total locations" : metric === "density" ? "Locations per 100k" : "Brand share %";

  return (
    <div className="flex-1 relative">
      <div ref={containerRef} className="w-full h-full" />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-[600] bg-[hsl(230,25%,13%)] border border-border rounded-lg px-3.5 py-2.5 pointer-events-none text-xs whitespace-nowrap shadow-lg"
        style={{ display: "none" }}
      />

      {/* Legend */}
      <div className="absolute bottom-6 left-6 bg-[hsl(230,25%,10%)]/95 border border-border rounded-lg px-4 py-3 z-[500] text-xs">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">{legendLabel}</div>
        <div className="flex gap-0.5">
          {[0, 0.2, 0.4, 0.6, 0.8].map((t) => (
            <div key={t} className="w-8 h-3.5 rounded-sm" style={{ background: interpolateColor(t) }} />
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
          <span>0</span>
          <span>{maxMetric.toFixed(metric === "total" ? 0 : 1)}</span>
        </div>
      </div>
    </div>
  );
};

export default MapView;
