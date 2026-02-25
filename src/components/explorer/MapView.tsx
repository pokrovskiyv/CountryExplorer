import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import * as topojson from "topojson-client";
import { useCountry } from "@/contexts/CountryContext";

type Metric = "total" | "density" | "share";
type Display = "choropleth" | "points" | "both" | "heatmap";

interface MapViewProps {
  selectedBrands: Set<string>;
  metric: Metric;
  display: Display;
  selectedRegion: string | null;
  onRegionSelect: (name: string) => void;
  topoData: any;
  visibleIndices?: Record<string, ReadonlySet<number>>;
}

function getMarkerRadius(zoom: number): number {
  if (zoom <= 6) return 2;
  if (zoom <= 8) return 3;
  if (zoom <= 10) return 4;
  if (zoom <= 12) return 5;
  return 6;
}

function getMarkerOpacity(zoom: number): number {
  if (zoom <= 6) return 0.65;
  if (zoom <= 8) return 0.75;
  return 0.85;
}

const MapView = ({ selectedBrands, metric, display, selectedRegion, onRegionSelect, topoData, visibleIndices }: MapViewProps) => {
  const { brands: BRANDS, regionCounts: REGION_COUNTS, population: POPULATION, brandPoints: BRAND_POINTS, interpolateColor, mapCenter, mapZoom } = useCountry();
  const mapRef = useRef<L.Map | null>(null);
  const regionLayerRef = useRef<L.GeoJSON | null>(null);
  const pointLayersRef = useRef<Record<string, L.LayerGroup>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);

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
  }, [selectedBrands, metric, POPULATION]);

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
      preferCanvas: true,
    }).setView(mapCenter, mapZoom);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png", {
      subdomains: "abcd",
      maxZoom: 18,
    }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png", {
      subdomains: "abcd",
      maxZoom: 18,
      pane: "shadowPane",
    }).addTo(map);

    // Custom pane for point markers — renders above region polygons
    // so bringToFront() on regions never covers the points
    map.createPane("pointsPane");
    map.getPane("pointsPane")!.style.zIndex = "450";

    mapRef.current = map;

    const hideTooltip = () => {
      if (tooltipRef.current) tooltipRef.current.style.display = "none";
    };
    map.on("zoomstart", hideTooltip);
    map.on("movestart", hideTooltip);

    return () => {
      map.off("zoomstart", hideTooltip);
      map.off("movestart", hideTooltip);
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
          fillOpacity: (display === "points" || display === "heatmap") ? 0.15 : 0.7,
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
          mousemove: (e) => {
            if (tooltipRef.current && containerRef.current) {
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
  }, [topoData, selectedBrands, metric, display, selectedRegion, getMetricValue, getMaxMetric, onRegionSelect, interpolateColor, BRANDS]);

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
      const zoom = map.getZoom();
      const radius = getMarkerRadius(zoom);
      const opacity = getMarkerOpacity(zoom);

      const sortedBrands = [...selectedBrands].sort(
        (a, b) => (BRAND_POINTS[a] || []).length - (BRAND_POINTS[b] || []).length
      );

      const allMarkers: L.CircleMarker[] = [];

      sortedBrands.forEach((brand) => {
        const pts = BRAND_POINTS[brand] || [];
        const vis = visibleIndices?.[brand];
        const filteredPts = vis ? pts.filter((_, i) => vis.has(i)) : pts;
        const markers = filteredPts.map((p) => {
          const marker = L.circleMarker([p[0], p[1]], {
            radius,
            fillColor: BRANDS[brand].color,
            color: "rgba(15,17,30,0.5)",
            weight: 1,
            fillOpacity: opacity,
            pane: "pointsPane",
          }).bindPopup(`<b>${brand}</b><br>${p[2]}<br>${p[3]} ${p[4]}`);
          allMarkers.push(marker);
          return marker;
        });
        pointLayersRef.current[brand] = L.layerGroup(markers).addTo(map);
      });

      const onZoomEnd = () => {
        const z = map.getZoom();
        const r = getMarkerRadius(z);
        const o = getMarkerOpacity(z);
        allMarkers.forEach((m) => {
          m.setRadius(r);
          m.setStyle({ fillOpacity: o });
        });
      };

      map.on("zoomend", onZoomEnd);

      return () => {
        map.off("zoomend", onZoomEnd);
      };
    }
  }, [selectedBrands, display, visibleIndices, BRAND_POINTS, BRANDS]);

  // Update heatmap layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (display !== "heatmap") return;

    const latlngs: [number, number][] = [];
    selectedBrands.forEach((brand) => {
      const pts = BRAND_POINTS[brand] || [];
      const vis = visibleIndices?.[brand];
      pts.forEach((p, i) => {
        if (!vis || vis.has(i)) {
          latlngs.push([p[0], p[1]]);
        }
      });
    });

    if (latlngs.length === 0) return;

    const heat = L.heatLayer(latlngs, {
      radius: 25,
      blur: 15,
      maxZoom: 12,
      minOpacity: 0.3,
      gradient: {
        0.2: "#1e3a8a",
        0.4: "#3b82f6",
        0.6: "#22d3ee",
        0.8: "#facc15",
        1.0: "#ef4444",
      },
    });

    heat.addTo(map);
    heatLayerRef.current = heat;

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [selectedBrands, display, visibleIndices, BRAND_POINTS]);

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
  const legendLabel = display === "heatmap"
    ? "Point density"
    : metric === "total"
      ? "Total locations"
      : metric === "density"
        ? "Locations per 100k"
        : "Brand share %";

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
        {display === "heatmap" ? (
          <>
            <div className="flex gap-0.5">
              {["#1e3a8a", "#3b82f6", "#22d3ee", "#facc15", "#ef4444"].map((color) => (
                <div key={color} className="w-8 h-3.5 rounded-sm" style={{ background: color }} />
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>Low</span>
              <span>High</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-0.5">
              {[0, 0.2, 0.4, 0.6, 0.8].map((t) => (
                <div key={t} className="w-8 h-3.5 rounded-sm" style={{ background: interpolateColor(t) }} />
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>0</span>
              <span>{maxMetric.toFixed(metric === "total" ? 0 : 1)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MapView;
