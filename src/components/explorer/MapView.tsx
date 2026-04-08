import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import * as topojson from "topojson-client";
import { useCountry } from "@/contexts/CountryContext";
import { useResolvedTheme, getTileUrls } from "@/hooks/useResolvedTheme";
import { buildPopupHtml, escapeHtml } from "@/lib/popup-builder";
import MapLegend from "@/components/explorer/MapLegend";
import type { LayerId, TrafficLayerOptions, LayerLegendConfig } from "@/hooks/map-layers/types";
import { useDeprivationGranularLayer } from "@/hooks/map-layers/useDeprivationGranularLayer";
import type { MsoaClickEvent } from "@/hooks/map-layers/useDeprivationGranularLayer";
import type { ContextTarget } from "@/components/explorer/ContextPanel";
import { useIncomeGranularLayer } from "@/hooks/map-layers/useIncomeGranularLayer";
import { usePeopleDensityLayer } from "@/hooks/map-layers/usePeopleDensityLayer";
import { STATION_DATA } from "@/data/station-data";
import { TRAFFIC_DATA } from "@/data/traffic-data";
import { computeStationOpportunities, computeAllStationSignals, fmt as fmtNumber } from "@/lib/opportunity-scoring";
import type { StationOpportunity, SignalProfile, ConfidenceLevel } from "@/lib/opportunity-scoring";

type Metric = "total" | "density" | "share";
type Display = "choropleth" | "points" | "both" | "heatmap";

interface MapViewProps {
  selectedBrands: Set<string>;
  perspectiveBrand?: string | null;
  metric: Metric;
  display: Display;
  selectedRegion: string | null;
  onRegionSelect: (name: string) => void;
  topoData: any;
  visibleIndices?: Record<string, ReadonlySet<number>>;
  activeLayers?: ReadonlySet<LayerId>;
  trafficOptions?: TrafficLayerOptions;
  initialCenter?: [number, number];
  initialZoom?: number;
  onMapPositionChange?: (center: [number, number], zoom: number) => void;
  onContextTarget?: (target: ContextTarget) => void;
  variant?: "default" | "smart-map";
  onStationSelect?: (stationName: string) => void;
  highlightedStation?: string | null;
  focusedStation?: string | null;
  onMapReady?: (map: L.Map) => void;
  junctionOpportunities?: readonly import("@/lib/multi-anchor-types").JunctionOpportunity[];
  onJunctionSelect?: (junctionId: string) => void;
  zoneOpportunities?: readonly import("@/lib/multi-anchor-types").MsoaOpportunity[];
  onZoneSelect?: (id: string) => void;
  mapStyle?: "default" | "satellite";
}

const EMPTY_LAYERS: ReadonlySet<LayerId> = new Set();

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

const BRAND_HEATMAP_ZOOM = 12; // below → auto-heatmap, at/above → individual markers

const STATION_ZOOM_TIERS = [
  { maxZoom: 7, minPassengers: 5_000_000 },
  { maxZoom: 9, minPassengers: 1_500_000 },
  { maxZoom: 11, minPassengers: 1_000_000 },
] as const;

function getStationThreshold(zoom: number): number {
  for (const t of STATION_ZOOM_TIERS) {
    if (zoom <= t.maxZoom) return t.minPassengers;
  }
  return 500_000;
}

function stationDivIcon(size: number, fillColor: string, strokeColor: string, strokeWidth: number): L.DivIcon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
    <circle cx="12" cy="12" r="11" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
    <rect x="7" y="6" width="10" height="10" rx="2" fill="white" opacity="0.9"/>
    <rect x="9" y="8" width="2.5" height="3" rx="0.5" fill="${fillColor}"/>
    <rect x="12.5" y="8" width="2.5" height="3" rx="0.5" fill="${fillColor}"/>
    <rect x="8" y="13" width="8" height="1.5" rx="0.5" fill="${fillColor}"/>
    <circle cx="9.5" cy="17.5" r="1" fill="white" opacity="0.9"/>
    <circle cx="14.5" cy="17.5" r="1" fill="white" opacity="0.9"/>
  </svg>`;
  const half = size / 2;
  return L.divIcon({
    className: "station-icon",
    html: svg,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

function numberedStationIcon(rank: number, size: number, tierColor: string): L.DivIcon {
  const showNumber = rank <= 10
  const half = size / 2
  const fontSize = Math.max(9, Math.min(12, size * 0.4))
  const html = showNumber
    ? `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${tierColor};border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:700;color:#000;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${rank}</div>`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${tierColor};border:1px solid rgba(255,255,255,0.4);opacity:0.7;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`
  return L.divIcon({
    className: "numbered-station-icon",
    html,
    iconSize: [size, size],
    iconAnchor: [half, half],
  })
}

function zoneDivIcon(size: number, color: string): L.DivIcon {
  const outer = size;
  const inner = Math.round(size * 0.36);
  const half = outer / 2;
  return L.divIcon({
    className: "zone-opp-icon",
    html: `<div style="width:${outer}px;height:${outer}px;border-radius:50%;border:2.5px solid ${color};background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 6px rgba(0,0,0,0.4)">
      <div style="width:${inner}px;height:${inner}px;border-radius:50%;background:${color}"></div>
    </div>`,
    iconSize: [outer, outer],
    iconAnchor: [half, half],
  });
}

function tierColor(score: number): string {
  if (score >= 80) return "#4ade80"
  if (score >= 60) return "#fbbf24"
  return "#94a3b8"
}

function junctionDivIcon(rank: number, size: number, color: string): L.DivIcon {
  const showNumber = rank <= 15
  const half = size / 2
  const fontSize = Math.max(8, Math.min(11, size * 0.35))
  const html = showNumber
    ? `<div style="width:${size}px;height:${size}px;transform:rotate(45deg);border-radius:3px;background:${color};border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4)"><span style="transform:rotate(-45deg);font-size:${fontSize}px;font-weight:700;color:#000">${rank}</span></div>`
    : `<div style="width:${size * 0.7}px;height:${size * 0.7}px;transform:rotate(45deg);border-radius:2px;background:${color};border:1px solid rgba(255,255,255,0.4);opacity:0.6;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`
  return L.divIcon({
    className: "junction-icon",
    html,
    iconSize: [size, size],
    iconAnchor: [half, half],
  })
}

// --- Station popup builder ---

function qsrColor(qsr: number): string {
  if (qsr <= 3) return "#ef4444";
  if (qsr <= 8) return "#f59e0b";
  return "#22c55e";
}

function fmtK(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1_000)}K`;
}

// --- Traffic heatmap max ---

const TLOG_MAX = Math.log(220_000);

// --- Opportunity colors ---

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#6b7280",
};

// --- Layer legends ---

const STATION_ANALYSIS_LEGEND: LayerLegendConfig = {
  type: "categorical",
  label: "Station analysis",
  items: [
    { color: "#22c55e", label: "High opportunity" },
    { color: "#f59e0b", label: "Medium opportunity" },
    { color: "#6b7280", label: "Low opportunity" },
    { color: "#94a3b8", label: "Not scored" },
  ],
};

const ZONE_OPPORTUNITIES_LEGEND: LayerLegendConfig = {
  type: "categorical",
  label: "Zone opportunities",
  items: [
    { color: "#06d6a0", label: "Act Now (80+)" },
    { color: "#06b6d4", label: "Evaluate (60-79)" },
  ],
};

const TRAFFIC_LEGEND: LayerLegendConfig = {
  type: "gradient",
  label: "Daily road traffic",
  colors: ["#16a34a", "#facc15", "#f97316", "#dc2626"],
  min: "25K",
  max: "200K+",
};



const MapView = ({ selectedBrands, perspectiveBrand = null, metric, display, selectedRegion, onRegionSelect, topoData, visibleIndices, activeLayers = EMPTY_LAYERS, trafficOptions, initialCenter, initialZoom, onMapPositionChange, onContextTarget, variant = "default", onStationSelect, highlightedStation, focusedStation, onMapReady, junctionOpportunities, onJunctionSelect, zoneOpportunities, onZoneSelect, mapStyle = "default" }: MapViewProps) => {
  const { brands: BRANDS, regionCounts: REGION_COUNTS, population: POPULATION, brandPoints: BRAND_POINTS, interpolateColor, mapCenter, mapZoom, brandAttributes } = useCountry();
  const mapRef = useRef<L.Map | null>(null);
  const regionLayerRef = useRef<L.GeoJSON | null>(null);
  const regionInteractionLayerRef = useRef<L.GeoJSON | null>(null);
  const pointLayersRef = useRef<Record<string, L.LayerGroup>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const baseTileRef = useRef<L.TileLayer | null>(null);
  const labelTileRef = useRef<L.TileLayer | null>(null);
  const resolvedTheme = useResolvedTheme();

  // Overlay layer refs
  const stationAnalysisRef = useRef<L.LayerGroup | null>(null);
  const stationMarkerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const focusCircleRef = useRef<L.Circle | null>(null);
  const focusedMarkerRef = useRef<L.Marker | null>(null);
  const junctionLayerRef = useRef<L.LayerGroup | null>(null);
  const zoneLayerRef = useRef<L.LayerGroup | null>(null);
  const trafficHeatRef = useRef<L.Layer | null>(null);
  const brandDimmedRef = useRef(false);
  const brandAutoHeatRef = useRef<L.Layer | null>(null);

  const handleMsoaClick = useCallback((event: MsoaClickEvent) => {
    onContextTarget?.({ type: "msoa", ...event });
  }, [onContextTarget]);

  const deprivationImdLegend = useDeprivationGranularLayer(mapRef, activeLayers.has("demographicImd"), handleMsoaClick, mapStyle);
  const incomeLegend = useIncomeGranularLayer(mapRef, activeLayers.has("demographicIncome"), mapStyle);
  const peopleDensityLegend = usePeopleDensityLayer(mapRef, activeLayers.has("peopleDensity"));

  const allBrands = useMemo(() => Object.keys(BRANDS), [BRANDS]);

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

    const center = initialCenter ?? mapCenter;
    const zoom = initialZoom ?? mapZoom;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
    }).setView(center, zoom);

    const urls = getTileUrls(resolvedTheme);
    baseTileRef.current = L.tileLayer(urls.base, {
      subdomains: "abcd",
      maxZoom: 18,
    }).addTo(map);

    labelTileRef.current = L.tileLayer(urls.labels, {
      subdomains: "abcd",
      maxZoom: 18,
      pane: "shadowPane",
    }).addTo(map);

    map.createPane("pointsPane");
    map.getPane("pointsPane")!.style.zIndex = "605";

    map.createPane("regionInteractionPane");
    map.getPane("regionInteractionPane")!.style.zIndex = "600";

    // Overlay panes
    map.createPane("trafficPane");
    map.getPane("trafficPane")!.style.zIndex = "440";
    map.createPane("stationPane");
    map.getPane("stationPane")!.style.zIndex = "610";

    mapRef.current = map;
    onMapReady?.(map);

    const hideTooltip = () => {
      if (tooltipRef.current) tooltipRef.current.style.display = "none";
    };
    map.on("zoomstart", hideTooltip);
    map.on("movestart", hideTooltip);

    const onMoveEnd = () => {
      if (onMapPositionChange) {
        const c = map.getCenter();
        onMapPositionChange([c.lat, c.lng], map.getZoom());
      }
    };
    map.on("moveend", onMoveEnd);

    // Invalidate size when container resizes (needed for flex layouts)
    const ro = new ResizeObserver(() => map.invalidateSize());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.off("zoomstart", hideTooltip);
      map.off("movestart", hideTooltip);
      map.off("moveend", onMoveEnd);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Swap tile URLs when theme or map style changes
  useEffect(() => {
    const urls = getTileUrls(resolvedTheme, mapStyle);
    if (baseTileRef.current) baseTileRef.current.setUrl(urls.base);
    if (labelTileRef.current) labelTileRef.current.setUrl(urls.labels);
  }, [resolvedTheme, mapStyle]);

  // Add/update region layer when topoData loads
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !topoData) return;

    if (regionLayerRef.current) {
      map.removeLayer(regionLayerRef.current);
      regionLayerRef.current = null;
    }
    if (regionInteractionLayerRef.current) {
      map.removeLayer(regionInteractionLayerRef.current);
      regionInteractionLayerRef.current = null;
    }

    const geojson = topojson.feature(topoData, Object.values(topoData.objects)[0] as any) as any;
    const maxVal = getMaxMetric();
    const isChoropleth = display === "choropleth";

    const showTooltip = (feature: any, e: L.LeafletMouseEvent) => {
      if (!tooltipRef.current || !containerRef.current) return;
      const props = feature.properties;
      let html = `<div class="font-semibold text-[13px] text-foreground mb-1">${escapeHtml(props.name)}</div>`;
      Object.keys(BRANDS).forEach((b) => {
        if (selectedBrands.has(b)) {
          html += `<div class="flex items-center gap-1.5 py-0.5"><span class="w-2 h-2 rounded-full inline-block" style="background:${BRANDS[b].color}"></span>${b}: <strong>${props[b] || 0}</strong></div>`;
        }
      });
      const total = getMetricValue(props);
      const label = metric === "density" ? " per 100k people" : metric === "share" ? "%" : " total";
      html += `<div class="mt-1 pt-1 border-t border-border font-semibold">Metric: ${total.toFixed(metric === "total" ? 0 : 1)}${label}</div>`;
      tooltipRef.current.innerHTML = html;
      tooltipRef.current.style.display = "block";
      const mapRect = containerRef.current.getBoundingClientRect();
      tooltipRef.current.style.left = (e.originalEvent.clientX - mapRect.left + 12) + "px";
      tooltipRef.current.style.top = (e.originalEvent.clientY - mapRect.top - 12) + "px";
    };

    const moveTooltip = (e: L.LeafletMouseEvent) => {
      if (!tooltipRef.current || !containerRef.current) return;
      const mapRect = containerRef.current.getBoundingClientRect();
      tooltipRef.current.style.left = (e.originalEvent.clientX - mapRect.left + 12) + "px";
      tooltipRef.current.style.top = (e.originalEvent.clientY - mapRect.top - 12) + "px";
    };

    const hideTooltip = () => {
      if (tooltipRef.current) tooltipRef.current.style.display = "none";
    };

    const visualLayer = L.geoJSON(geojson, {
      style: (feature) => {
        if (!feature) return {};
        const val = getMetricValue(feature.properties);
        const intensity = maxVal > 0 ? val / maxVal : 0;

        if (isChoropleth || display === "both") {
          return {
            fillColor: interpolateColor(intensity),
            weight: 1.5,
            color: "#3a3f52",
            fillOpacity: display === "both" ? 0.5 : 0.7,
          };
        }
        return {
          fillColor: "transparent",
          fillOpacity: 0.05,
          weight: 1.5,
          color: "rgba(100, 116, 139, 0.4)",
          dashArray: "5 3",
        };
      },
      ...(isChoropleth
        ? {
            onEachFeature: (feature: any, lyr: L.Layer) => {
              lyr.on({
                mouseover: (e: L.LeafletMouseEvent) => {
                  e.target.setStyle({ weight: 2.5, color: "#60a5fa" });
                  e.target.bringToFront();
                  showTooltip(feature, e);
                },
                mousemove: (e: L.LeafletMouseEvent) => { moveTooltip(e); },
                mouseout: (e: L.LeafletMouseEvent) => {
                  visualLayer.resetStyle(e.target);
                  hideTooltip();
                },
                click: () => {
                  onRegionSelect(feature.properties.name);
                },
              });
            },
          }
        : {}),
    }).addTo(map);

    regionLayerRef.current = visualLayer;

    if (!isChoropleth) {
      const hoverFillOpacity = display === "both" ? 0.35 : 0.1;
      const visualLayerIndex = new Map<string, any>();
      visualLayer.eachLayer((vl: any) => {
        if (vl.feature?.properties.name) {
          visualLayerIndex.set(vl.feature.properties.name, vl);
        }
      });

      const interactionLayer = L.geoJSON(geojson, {
        pane: "regionInteractionPane",
        style: () => ({ fillOpacity: 0, weight: 0, opacity: 0 }),
        onEachFeature: (feature: any, lyr: L.Layer) => {
          lyr.on({
            mouseover: (e: L.LeafletMouseEvent) => {
              const vl = visualLayerIndex.get(feature.properties.name);
              if (vl) {
                vl.setStyle({ weight: 2.5, color: "#60a5fa", fillOpacity: hoverFillOpacity, dashArray: "" });
              }
              showTooltip(feature, e);
            },
            mousemove: (e: L.LeafletMouseEvent) => { moveTooltip(e); },
            mouseout: () => {
              const vl = visualLayerIndex.get(feature.properties.name);
              if (vl) {
                visualLayer.resetStyle(vl);
              }
              hideTooltip();
            },
            click: () => { onRegionSelect(feature.properties.name); },
          });
        },
      }).addTo(map);

      regionInteractionLayerRef.current = interactionLayer;
    }
  }, [topoData, selectedBrands, metric, display, getMetricValue, getMaxMetric, onRegionSelect, interpolateColor, BRANDS]);

  // Highlight selected region
  useEffect(() => {
    if (!regionLayerRef.current) return;
    const selectedFillOpacity = display === "choropleth" ? 0.7 : display === "both" ? 0.5 : 0.15;
    regionLayerRef.current.eachLayer((l: any) => {
      regionLayerRef.current!.resetStyle(l);
      if (selectedRegion && l.feature?.properties.name === selectedRegion) {
        l.setStyle({ weight: 3, color: "#60a5fa", fillColor: "#60a5fa", fillOpacity: selectedFillOpacity, dashArray: "" });
      }
    });
  }, [selectedRegion, display]);

  // Update points — zoom-adaptive: heatmap at low zoom, individual markers at high zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(pointLayersRef.current).forEach((lg) => map.removeLayer(lg));
    pointLayersRef.current = {};
    if (brandAutoHeatRef.current) { map.removeLayer(brandAutoHeatRef.current); brandAutoHeatRef.current = null; }

    if (display === "points" || display === "both") {
      const zoom = map.getZoom();
      const radius = getMarkerRadius(zoom);
      const opacity = brandDimmedRef.current ? 0.18 : getMarkerOpacity(zoom);

      // Perspective-brand markers get a size boost + thicker ring so the user
      // can visually spot their focus brand against competitors.
      const perspectiveRadius = radius + 3;
      const perspectiveOpacity = Math.min(1, opacity + 0.1);

      const sortedBrands = [...selectedBrands].sort(
        (a, b) => (BRAND_POINTS[a] || []).length - (BRAND_POINTS[b] || []).length
      );

      // Ensure the perspective brand renders LAST (on top of competitors).
      if (perspectiveBrand && sortedBrands.includes(perspectiveBrand)) {
        const idx = sortedBrands.indexOf(perspectiveBrand);
        sortedBrands.splice(idx, 1);
        sortedBrands.push(perspectiveBrand);
      }

      const allMarkers: L.CircleMarker[] = [];
      const perspectiveMarkers: L.CircleMarker[] = [];
      const heatPoints: [number, number][] = [];

      sortedBrands.forEach((brand) => {
        const isPerspective = brand === perspectiveBrand;
        const pts = BRAND_POINTS[brand] || [];
        const vis = visibleIndices?.[brand];
        const indexedPts = pts.map((p, i) => ({ p, i }));
        const filtered = vis ? indexedPts.filter(({ i }) => vis.has(i)) : indexedPts;
        const markers = filtered.map(({ p, i: origIdx }) => {
          const attrs = brandAttributes?.[brand]?.[origIdx];
          heatPoints.push([p[0], p[1]]);
          const marker = L.circleMarker([p[0], p[1]], {
            radius: isPerspective ? perspectiveRadius : radius,
            fillColor: BRANDS[brand].color,
            color: isPerspective ? "#ffffff" : "rgba(15,17,30,0.5)",
            weight: isPerspective ? 2.5 : 1,
            fillOpacity: isPerspective ? perspectiveOpacity : opacity,
            pane: "pointsPane",
          });
          const html = buildPopupHtml(brand, p, attrs);
          if (display !== "choropleth") {
            marker.bindTooltip(html, { direction: "top", offset: [0, -8] });
          }
          marker.on("click", () => {
            onContextTarget?.({
              type: "restaurant",
              lat: p[0],
              lon: p[1],
              brand,
              address: p[2],
              city: p[3],
              postcode: p[4],
              attrs,
            });
          });
          allMarkers.push(marker);
          if (isPerspective) perspectiveMarkers.push(marker);
          return marker;
        });
        pointLayersRef.current[brand] = L.layerGroup(markers);
      });

      // Zoom-adaptive visibility: heatmap at low zoom, markers at high zoom
      const showMarkersOnMap = (show: boolean) => {
        Object.values(pointLayersRef.current).forEach((lg) => {
          if (show) { if (!map.hasLayer(lg)) lg.addTo(map); }
          else { if (map.hasLayer(lg)) map.removeLayer(lg); }
        });
      };

      const showAutoHeat = (show: boolean) => {
        if (show && !brandAutoHeatRef.current && heatPoints.length > 0) {
          const dimmed = brandDimmedRef.current;
          const heat = L.heatLayer(heatPoints, {
            radius: 25, blur: 15, maxZoom: 12, minOpacity: dimmed ? 0.1 : 0.3,
            gradient: { 0.2: "#1e3a8a", 0.4: "#3b82f6", 0.6: "#22d3ee", 0.8: "#facc15", 1.0: "#ef4444" },
          });
          heat.addTo(map);
          const heatCanvas = (heat as any)._canvas;
          if (heatCanvas) heatCanvas.style.pointerEvents = "none";
          brandAutoHeatRef.current = heat;
        } else if (!show && brandAutoHeatRef.current) {
          map.removeLayer(brandAutoHeatRef.current);
          brandAutoHeatRef.current = null;
        }
      };

      const updateVisibility = () => {
        const z = map.getZoom();
        const useHeat = z < BRAND_HEATMAP_ZOOM;

        showAutoHeat(useHeat);
        showMarkersOnMap(!useHeat);

        if (!useHeat) {
          const r = getMarkerRadius(z);
          const o = brandDimmedRef.current ? 0.18 : getMarkerOpacity(z);
          const pr = r + 3;
          const po = Math.min(1, o + 0.1);
          const perspectiveSet = new Set(perspectiveMarkers);
          allMarkers.forEach((m) => {
            if (perspectiveSet.has(m)) {
              m.setRadius(pr);
              m.setStyle({ fillOpacity: po });
            } else {
              m.setRadius(r);
              m.setStyle({ fillOpacity: o });
            }
          });
        }
      };

      updateVisibility();
      map.on("zoomend", updateVisibility);
      return () => {
        map.off("zoomend", updateVisibility);
        if (brandAutoHeatRef.current) { map.removeLayer(brandAutoHeatRef.current); brandAutoHeatRef.current = null; }
      };
    }
  }, [selectedBrands, perspectiveBrand, display, visibleIndices, BRAND_POINTS, BRANDS, brandAttributes]);

  // Dim brand markers (or auto-heatmap) when station analysis overlay is active
  useEffect(() => {
    const dimmed = activeLayers.has("stationAnalysis") && (display === "points" || display === "both");
    brandDimmedRef.current = dimmed;
    // Dim individual markers (visible at high zoom)
    const targetOpacity = dimmed ? 0.18 : getMarkerOpacity(mapRef.current?.getZoom() ?? 8);
    Object.values(pointLayersRef.current).forEach((lg) => {
      lg.eachLayer((layer) => {
        (layer as L.CircleMarker).setStyle({ fillOpacity: targetOpacity });
      });
    });
    // Dim auto-heatmap (visible at low zoom) by rebuilding with lower minOpacity
    if (brandAutoHeatRef.current && mapRef.current) {
      const map = mapRef.current;
      map.removeLayer(brandAutoHeatRef.current);
      brandAutoHeatRef.current = null;
      // The next zoomend or re-render will rebuild the heatmap with correct opacity
      // Force a rebuild by dispatching a synthetic zoomend
      map.fire("zoomend");
    }
  }, [activeLayers.has("stationAnalysis"), display]);

  // Update heatmap layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }
    if (display !== "heatmap") return;

    const latlngs: [number, number][] = [];
    selectedBrands.forEach((brand) => {
      const pts = BRAND_POINTS[brand] || [];
      const vis = visibleIndices?.[brand];
      pts.forEach((p, i) => { if (!vis || vis.has(i)) latlngs.push([p[0], p[1]]); });
    });
    if (latlngs.length === 0) return;

    const heat = L.heatLayer(latlngs, {
      radius: 25, blur: 15, maxZoom: 12, minOpacity: 0.3,
      gradient: { 0.2: "#1e3a8a", 0.4: "#3b82f6", 0.6: "#22d3ee", 0.8: "#facc15", 1.0: "#ef4444" },
    });
    heat.addTo(map);
    const heatCanvas = (heat as any)._canvas;
    if (heatCanvas) heatCanvas.style.pointerEvents = "none";
    heatLayerRef.current = heat;

    return () => { if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; } };
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

  // ═══════════════════════════════════════════════════════════
  // OVERLAY LAYERS — each is a self-contained useEffect
  // using mapRef.current (always fresh, unlike state)
  // ═══════════════════════════════════════════════════════════


  // Station analysis — combined footfall + opportunity score
  const opportunities = useMemo(() => computeStationOpportunities(allBrands), [allBrands.join(",")]);

  const oppByStation = useMemo(() => {
    const m = new Map<string, (typeof opportunities)[number]>();
    for (const opp of opportunities) m.set(opp.station.name, opp);
    return m;
  }, [opportunities]);

  const allStationSignals = useMemo(() => computeAllStationSignals(), []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (stationAnalysisRef.current) { map.removeLayer(stationAnalysisRef.current); stationAnalysisRef.current = null; }
    if (!activeLayers.has("stationAnalysis")) return;

    const maxEntries = STATION_DATA[0]?.annualEntries || 1;
    const walkMin = Math.round((0.8 * 1.35) / 5 * 60);

    const buildStationMarkers = (threshold: number): L.Marker[] => {
      const result: L.Marker[] = [];
      for (const station of STATION_DATA) {
        if (station.annualEntries < threshold) continue;

        const opp = oppByStation.get(station.name);
        const ratio = station.annualEntries / maxEntries;
        const color = opp ? CONFIDENCE_COLORS[opp.confidence] : "#94a3b8";
        const qsr = station.qsrCount800m;
        const isTop = opp ? opp.rank <= 10 : false;

        const brandList = Object.entries(station.brandCounts800m).filter(([, c]) => c > 0).map(([b, c]) => `${b}: ${c}`).join(", ");
        const absent = Object.entries(station.brandCounts800m).filter(([, c]) => c === 0).map(([b]) => b).join(", ");

        let popup = `<div style="font-size:13px;min-width:260px;max-width:300px;overflow:hidden">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <div style="font-weight:700">\u{1F689} ${escapeHtml(station.name)}</div>
            ${opp ? `<div style="background:${color};color:white;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px">${opp.compositeScore.toFixed(0)}</div>` : ""}
          </div>
          <div style="color:#94a3b8;font-size:11px;margin-bottom:8px">${escapeHtml(station.region)}${opp ? ` \u00b7 ${opp.signalCount} signals \u00b7 ${opp.confidence} confidence` : ""}</div>
          <div style="display:flex;gap:12px;margin-bottom:8px">
            <div style="text-align:center;flex:1;background:rgba(99,102,241,0.1);border-radius:6px;padding:6px 4px">
              <div style="font-size:18px;font-weight:700;color:#818cf8">${fmtK(station.annualEntries)}</div>
              <div style="font-size:10px;color:#94a3b8">passengers/yr</div>
            </div>
            <div style="text-align:center;flex:1;background:${qsr <= 3 ? "rgba(239,68,68,0.1)" : qsr <= 8 ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)"};border-radius:6px;padding:6px 4px">
              <div style="font-size:18px;font-weight:700;color:${qsrColor(qsr)}">${qsr}</div>
              <div style="font-size:10px;color:#94a3b8">QSR ~${walkMin} min walk</div>
            </div>
          </div>
          <div style="margin-bottom:6px;font-size:11px;color:#94a3b8">\u{1F68F} ${station.busStopCount800m} bus stops nearby \u2014 ${station.busStopCount800m >= 40 ? '<span style="color:#22c55e">high pedestrian area</span>' : station.busStopCount800m >= 15 ? "moderate area" : '<span style="color:#ef4444">low pedestrian area</span>'}</div>
          ${brandList ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:3px">\u2713 Present: ${escapeHtml(brandList)}</div>` : ""}
          ${absent ? `<div style="font-size:11px;color:#f59e0b;margin-bottom:3px">\u2717 Missing: ${escapeHtml(absent)}</div>` : ""}`;

        const sp: SignalProfile = opp?.signalProfile ?? allStationSignals.get(station.name) ?? {
          footfall: 0, brandGap: 0, demographic: 0, density: 0, pedestrian: 0, roadTraffic: 0, workforceDensity: 0,
        };
        const signals = [
          { l: "Footfall", v: sp.footfall },
          { l: "Brand gap", v: sp.brandGap },
          { l: "Demographic", v: sp.demographic },
          { l: "Density", v: sp.density },
          { l: "Pedestrian", v: sp.pedestrian },
          { l: "Road traffic", v: sp.roadTraffic },
          { l: "Workforce", v: sp.workforceDensity },
        ];
        popup += `<div style="margin-top:6px">`;
        for (const s of signals) {
          const pct = Math.round(s.v);
          const bc = pct > 60 ? "#22c55e" : pct > 30 ? "#f59e0b" : "#6b7280";
          popup += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><div style="width:70px;flex-shrink:0;font-size:10px;color:#94a3b8">${s.l}</div><div style="flex:1;min-width:0;background:rgba(100,116,139,0.2);border-radius:2px;height:6px;overflow:hidden"><div style="width:${pct}%;background:${bc};border-radius:2px;height:6px"></div></div><div style="width:24px;flex-shrink:0;text-align:right;font-size:10px;color:#94a3b8">${pct}</div></div>`;
        }
        popup += `</div>`;
        popup += `</div>`;

        const size = 16 + ratio * 16;
        const icon = stationDivIcon(size, color, isTop ? "#ffffff" : "rgba(255,255,255,0.5)", isTop ? 2 : 1);
        const marker = L.marker([station.lat, station.lon], { icon, pane: "stationPane", interactive: true });
        marker.bindPopup(popup, { maxWidth: 320 });
        if (variant === "smart-map" && onStationSelect) {
          marker.on("click", () => onStationSelect(station.name));
          (marker as any)._stationName = station.name;
        } else {
          marker.on("click", () => onRegionSelect(station.region));
        }
        result.push(marker);
      }
      return result;
    };

    // Build initial markers with zoom-appropriate threshold
    let currentThreshold = getStationThreshold(map.getZoom());
    stationAnalysisRef.current = L.layerGroup(buildStationMarkers(currentThreshold)).addTo(map);

    const onZoomEnd = () => {
      const newThreshold = getStationThreshold(map.getZoom());
      if (newThreshold === currentThreshold) return;
      currentThreshold = newThreshold;
      // Build new layer before removing old one to avoid flicker
      const newLayer = L.layerGroup(buildStationMarkers(newThreshold)).addTo(map);
      if (stationAnalysisRef.current) map.removeLayer(stationAnalysisRef.current);
      stationAnalysisRef.current = newLayer;
    };
    map.on("zoomend", onZoomEnd);

    return () => {
      map.off("zoomend", onZoomEnd);
      if (stationAnalysisRef.current) { map.removeLayer(stationAnalysisRef.current); stationAnalysisRef.current = null; }
    };
  }, [activeLayers.has("stationAnalysis"), oppByStation, variant]);

  // Smart-map: highlight station on card hover
  useEffect(() => {
    if (variant !== "smart-map" || !stationAnalysisRef.current) return;
    stationAnalysisRef.current.eachLayer((layer: any) => {
      const name = layer._stationName;
      if (!name) return;
      const el = layer.getElement?.();
      if (!el) return;
      if (name === highlightedStation) {
        el.style.filter = "drop-shadow(0 0 6px rgba(74,158,255,0.8))";
        el.style.zIndex = "1000";
      } else {
        el.style.filter = "";
        el.style.zIndex = "";
      }
    });
  }, [highlightedStation, variant]);

  // Smart-map: focus station (800m circle + fade others)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || variant !== "smart-map") return;

    // Clean up previous focus
    if (focusCircleRef.current) {
      map.removeLayer(focusCircleRef.current);
      focusCircleRef.current = null;
    }
    if (focusedMarkerRef.current) {
      map.removeLayer(focusedMarkerRef.current);
      focusedMarkerRef.current = null;
    }

    if (!focusedStation) {
      // Restore opacity on all markers
      if (stationAnalysisRef.current) {
        stationAnalysisRef.current.eachLayer((layer: any) => {
          const el = layer.getElement?.();
          if (el) el.style.opacity = "1";
        });
      }
      return;
    }

    // Find the focused station marker and get its position
    let focusedLatLng: L.LatLng | null = null;
    let foundInLayer = false;
    if (stationAnalysisRef.current) {
      stationAnalysisRef.current.eachLayer((layer: any) => {
        const el = layer.getElement?.();
        if (!el) return;
        if (layer._stationName === focusedStation) {
          el.style.opacity = "1";
          focusedLatLng = layer.getLatLng?.();
          foundInLayer = true;
        } else {
          el.style.opacity = "0.3";
        }
      });
    }

    // Fallback: look up station coordinates from STATION_DATA if layer is off
    const stationRecord = STATION_DATA.find((s) => s.name === focusedStation);
    if (!focusedLatLng && stationRecord) {
      focusedLatLng = L.latLng(stationRecord.lat, stationRecord.lon);
    }

    // If station not visible in layer, add a temporary marker
    if (focusedLatLng && !foundInLayer && stationRecord) {
      const icon = stationDivIcon(32, "#4ade80", "#ffffff", 2);
      focusedMarkerRef.current = L.marker(focusedLatLng, {
        icon,
        pane: "stationPane",
        interactive: true,
      }).addTo(map);
      focusedMarkerRef.current.bindPopup(
        `<div style="font-family:system-ui"><strong>${stationRecord.name}</strong><br/><span style="color:#888">${stationRecord.region}</span></div>`,
        { maxWidth: 200 },
      );
    }

    // Draw 800m radius circle
    if (focusedLatLng) {
      focusCircleRef.current = L.circle(focusedLatLng, {
        radius: 800,
        color: "#4ade80",
        weight: 2,
        dashArray: "6 4",
        fillColor: "#4ade80",
        fillOpacity: 0.03,
        interactive: false,
      }).addTo(map);

      map.flyTo(focusedLatLng, Math.max(map.getZoom(), 13), { duration: 0.8 });
    }

    return () => {
      if (focusCircleRef.current && map) {
        map.removeLayer(focusCircleRef.current);
        focusCircleRef.current = null;
      }
      if (focusedMarkerRef.current && map) {
        map.removeLayer(focusedMarkerRef.current);
        focusedMarkerRef.current = null;
      }
    };
  }, [focusedStation, variant]);

  // Smart-map: junction opportunity markers (diamond shapes) — tied to traffic layer
  useEffect(() => {
    const map = mapRef.current
    const showJunctions = variant === "smart-map" && activeLayers.has("traffic") && junctionOpportunities?.length
    if (!map || !showJunctions) {
      if (junctionLayerRef.current) {
        map?.removeLayer(junctionLayerRef.current)
        junctionLayerRef.current = null
      }
      return
    }

    if (junctionLayerRef.current) {
      map.removeLayer(junctionLayerRef.current)
    }

    const group = L.layerGroup()
    const topN = junctionOpportunities.slice(0, 200) // limit for performance

    for (const opp of topN) {
      const size = 12 + (opp.compositeScore / 100) * 16
      const icon = junctionDivIcon(opp.rank, Math.max(size, opp.rank <= 15 ? 24 : 10), tierColor(opp.compositeScore))

      const popup = `
        <div style="font-family:system-ui;min-width:200px">
          <div style="font-weight:600;font-size:14px;margin-bottom:4px">${opp.trafficPoint.roadName}</div>
          <div style="color:#888;font-size:12px;margin-bottom:8px">${opp.region} · Score: ${opp.compositeScore}</div>
          <div style="display:flex;gap:8px;font-size:11px;margin-bottom:4px">
            <span style="color:#6366f1">${Math.round(opp.trafficPoint.aadf / 1000)}K veh/day</span>
            <span style="color:${opp.driveThruCount === 0 ? '#22c55e' : '#eab308'}">${opp.driveThruCount} drive-thru</span>
          </div>
          <div style="font-size:11px;color:#888">${opp.qsrCount} QSR within 1.5km</div>
        </div>
      `

      const marker = L.marker([opp.lat, opp.lng], {
        icon,
        pane: "stationPane",
        interactive: true,
      })
      marker.bindPopup(popup, { maxWidth: 280 })

      if (onJunctionSelect) {
        marker.on("click", () => onJunctionSelect(opp.id))
      }

      group.addLayer(marker)
    }

    group.addTo(map)
    junctionLayerRef.current = group

    return () => {
      if (junctionLayerRef.current && map) {
        map.removeLayer(junctionLayerRef.current)
        junctionLayerRef.current = null
      }
    }
  }, [variant, junctionOpportunities, activeLayers.has("traffic")])

  // Zone opportunity markers — square icons, score >= 60
  useEffect(() => {
    const map = mapRef.current
    if (zoneLayerRef.current) {
      map?.removeLayer(zoneLayerRef.current)
      zoneLayerRef.current = null
    }
    if (!map || !activeLayers.has("zoneOpportunities") || !zoneOpportunities?.length) return

    const group = L.layerGroup()
    const filtered = zoneOpportunities.filter((z) => z.compositeScore >= 60)

    for (const opp of filtered) {
      const size = opp.compositeScore >= 80 ? 22 : 16
      const color = opp.compositeScore >= 80 ? "#06d6a0" : "#06b6d4"
      const icon = zoneDivIcon(size, color)

      const popup = `
        <div style="font-family:system-ui;min-width:180px">
          <div style="font-weight:600;font-size:13px;margin-bottom:4px">${opp.label}</div>
          <div style="color:#888;font-size:12px;margin-bottom:8px">${opp.region} · Score: ${opp.compositeScore}</div>
          <div style="display:flex;gap:8px;font-size:11px;margin-bottom:4px">
            <span style="color:#06b6d4">${Math.round(opp.analysis.workplacePop / 1000)}K workers</span>
            <span style="color:${opp.brandGaps.length > 0 ? '#22c55e' : '#888'}">${opp.brandGaps.length} brand gaps</span>
          </div>
          <div style="font-size:11px;color:#888">${opp.qsrCount} QSR nearby</div>
        </div>
      `

      const marker = L.marker([opp.lat, opp.lng], {
        icon,
        pane: "stationPane",
        interactive: true,
      })
      marker.bindPopup(popup, { maxWidth: 250 })

      if (onZoneSelect) {
        marker.on("click", () => onZoneSelect(opp.id))
      }

      group.addLayer(marker)
    }

    group.addTo(map)
    zoneLayerRef.current = group

    return () => {
      if (zoneLayerRef.current && map) {
        map.removeLayer(zoneLayerRef.current)
        zoneLayerRef.current = null
      }
    }
  }, [zoneOpportunities, activeLayers.has("zoneOpportunities")])

  // Road traffic flow overlay — heatmap only
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (trafficHeatRef.current) { map.removeLayer(trafficHeatRef.current); trafficHeatRef.current = null; }
    if (!activeLayers.has("traffic")) return;

    const driveThruOnly = trafficOptions?.driveThruOnly ?? false;
    const heatPoints: [number, number, number][] = [];

    for (const pt of TRAFFIC_DATA) {
      if (!driveThruOnly || pt.aadf >= 50_000) {
        heatPoints.push([pt.lat, pt.lon, Math.log(Math.max(1, pt.aadf))]);
      }
    }

    const trafficHeat = (L as any).heatLayer(heatPoints, {
      radius: 18,
      blur: 14,
      maxZoom: 12,
      max: TLOG_MAX,
      minOpacity: 0.3,
      gradient: {
        0.25: "#16a34a",
        0.5: "#facc15",
        0.75: "#f97316",
        1.0: "#dc2626",
      },
    });
    trafficHeat.addTo(map);
    const heatCanvas = (trafficHeat as any)._canvas;
    if (heatCanvas) heatCanvas.style.pointerEvents = "none";
    trafficHeatRef.current = trafficHeat;

    return () => {
      if (trafficHeatRef.current) { map.removeLayer(trafficHeatRef.current); trafficHeatRef.current = null; }
    };
  }, [activeLayers.has("traffic"), trafficOptions?.driveThruOnly]);

  // Build overlay legends
  const overlayLegends = useMemo(() => {
    const items: { id: string; config: LayerLegendConfig }[] = [];
    if (activeLayers.has("stationAnalysis")) items.push({ id: "stationAnalysis", config: STATION_ANALYSIS_LEGEND });
    if (activeLayers.has("zoneOpportunities")) items.push({ id: "zoneOpportunities", config: ZONE_OPPORTUNITIES_LEGEND });
    if (activeLayers.has("traffic")) items.push({ id: "traffic", config: TRAFFIC_LEGEND });
    if (incomeLegend) items.push({ id: "demographicIncome", config: incomeLegend });
    if (deprivationImdLegend) items.push({ id: "demographicImd", config: deprivationImdLegend });
    if (peopleDensityLegend) items.push({ id: "peopleDensity", config: peopleDensityLegend });
    return items;
  }, [activeLayers, incomeLegend, deprivationImdLegend, peopleDensityLegend]);

  // Legend
  const maxMetric = getMaxMetric();
  const legendLabel = display === "heatmap"
    ? "Point density"
    : metric === "total"
      ? "Total locations"
      : metric === "density"
        ? "Per 100k people"
        : "Market share";

  return (
    <div className="flex-1 relative">
      <div ref={containerRef} className="w-full h-full" />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-[600] bg-surface-1 border border-border rounded-lg px-3.5 py-2.5 pointer-events-none text-xs whitespace-nowrap shadow-lg"
        style={{ display: "none" }}
      />

      {/* Legend */}
      <MapLegend
        label={legendLabel}
        display={display}
        metric={metric}
        maxMetric={maxMetric}
        interpolateColor={interpolateColor}
        items={overlayLegends}
      />
    </div>
  );
};

export default MapView;
