import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as topojson from "topojson-client";
import { useCountry } from "@/contexts/CountryContext";
import type { RegionScore } from "@/lib/expansion-scoring";
import { interpolateRadarColor, getTierColor } from "@/lib/opportunity-colors";

interface RadarMapViewProps {
  readonly topoData: any;
  readonly scores: readonly RegionScore[];
  readonly selectedRegion: string | null;
  readonly onRegionSelect: (name: string) => void;
  readonly targetBrand: string;
}

const RadarMapView = ({
  topoData,
  scores,
  selectedRegion,
  onRegionSelect,
  targetBrand,
}: RadarMapViewProps) => {
  const { brands: BRANDS, regionCentroids: REGION_CENTROIDS, mapCenter, mapZoom } = useCountry();
  const mapRef = useRef<L.Map | null>(null);
  const regionLayerRef = useRef<L.GeoJSON | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Memoize score lookups to avoid re-creation on every render
  const scoreMap = useMemo(
    () => new Map(scores.map((s) => [s.region, s])),
    [scores]
  );
  const topRegions = useMemo(
    () => new Set(scores.slice(0, 3).map((s) => s.region)),
    [scores]
  );

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
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

  // Add/update region choropleth + labels
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !topoData || scores.length === 0) return;

    // Clear old layers
    if (regionLayerRef.current) {
      map.removeLayer(regionLayerRef.current);
    }
    if (labelLayerRef.current) {
      map.removeLayer(labelLayerRef.current);
    }

    const geojson = topojson.feature(
      topoData,
      Object.values(topoData.objects)[0] as any
    ) as any;

    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        if (!feature) return {};
        const regionScore = scoreMap.get(feature.properties.name);
        const t = regionScore ? regionScore.composite / 100 : 0;
        const isTop = topRegions.has(feature.properties.name);
        return {
          fillColor: interpolateRadarColor(t),
          weight: isTop ? 2 : 1.5,
          color: isTop ? getTierColor(regionScore?.tier || "Cold") + "80" : "#2a2d3a",
          fillOpacity: 0.75,
          className: isTop ? "radar-pulse" : undefined,
        };
      },
      onEachFeature: (feature, lyr) => {
        lyr.on({
          mouseover: (e) => {
            const target = e.target;
            target.setStyle({ weight: 2.5, color: "#60a5fa" });
            target.bringToFront();

            if (tooltipRef.current && containerRef.current) {
              const regionScore = scoreMap.get(feature.properties.name);
              if (!regionScore) return;

              const tierColor = getTierColor(regionScore.tier);
              let html = `
                <div class="font-semibold text-[13px] text-white mb-1.5">${feature.properties.name}</div>
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-lg font-bold tabular-nums" style="color:${tierColor}">${regionScore.composite}</span>
                  <span class="text-[11px] px-1.5 py-0.5 rounded-full font-semibold" style="color:${tierColor};background:${tierColor}20">${regionScore.tier}</span>
                </div>
                <div class="space-y-0.5 text-[11px]">
                  <div class="flex justify-between"><span class="text-slate-400">Penetration Gap</span><span class="font-medium">${regionScore.breakdown.penetrationGap}</span></div>
                  <div class="flex justify-between"><span class="text-slate-400">Competition</span><span class="font-medium">${regionScore.breakdown.competitorPresence}</span></div>
                  <div class="flex justify-between"><span class="text-slate-400">Population</span><span class="font-medium">${regionScore.breakdown.populationScore}</span></div>
                  <div class="flex justify-between"><span class="text-slate-400">Headroom</span><span class="font-medium">${regionScore.breakdown.densityHeadroom}</span></div>
                </div>
                <div class="mt-1.5 pt-1.5 border-t border-[hsl(230,25%,20%)] text-[11px] text-slate-400">
                  ${regionScore.brandCount} ${targetBrand} · ${regionScore.totalCount} total QSR
                </div>`;

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

    // Add score labels at centroids
    const labelGroup = L.layerGroup();
    for (const regionScore of scores) {
      const centroid = REGION_CENTROIDS[regionScore.region];
      if (!centroid) continue;

      const tierColor = getTierColor(regionScore.tier);
      const icon = L.divIcon({
        className: "radar-score-label",
        html: `<div style="
          background: hsl(230,25%,12%);
          border: 1.5px solid ${tierColor}90;
          border-radius: 6px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 700;
          color: ${tierColor};
          white-space: nowrap;
          text-align: center;
          font-variant-numeric: tabular-nums;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        ">${regionScore.composite}</div>`,
        iconSize: [32, 20],
        iconAnchor: [16, 10],
      });

      L.marker(centroid, { icon, interactive: false }).addTo(labelGroup);
    }

    labelGroup.addTo(map);
    labelLayerRef.current = labelGroup;
  }, [topoData, scores, scoreMap, topRegions, selectedRegion, onRegionSelect, targetBrand]);

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

  return (
    <div className="flex-1 relative">
      <div ref={containerRef} className="w-full h-full" />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-[600] bg-[hsl(230,25%,11%)] border border-border rounded-lg px-3.5 py-2.5 pointer-events-none text-xs whitespace-nowrap shadow-xl"
        style={{ display: "none" }}
      />

      {/* Legend */}
      <div className="absolute bottom-6 left-6 bg-[hsl(230,25%,10%)]/95 border border-border rounded-lg px-4 py-3 z-[500] text-xs">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">
          Expansion opportunity
        </div>

        {/* Continuous gradient bar */}
        <div
          className="h-3 rounded-full"
          style={{
            background: `linear-gradient(to right, rgb(51,65,85) 0%, rgb(20,148,132) 25%, rgb(245,158,11) 50%, rgb(239,68,68) 75%, rgb(236,72,153) 100%)`,
          }}
        />

        <div className="flex justify-between mt-1">
          <span className="text-[10px] tabular-nums text-muted-foreground">0</span>
          <span className="text-[10px] tabular-nums text-muted-foreground">100</span>
        </div>
      </div>

      {/* Brand indicator */}
      <div className="absolute top-4 left-4 bg-[hsl(230,25%,10%)]/95 border border-border rounded-lg px-3 py-2 z-[500] flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: BRANDS[targetBrand]?.color || "#3b82f6" }}
        />
        <span className="text-[12px] font-medium text-slate-200">
          {targetBrand} Expansion Radar
        </span>
      </div>
    </div>
  );
};

export default RadarMapView;
