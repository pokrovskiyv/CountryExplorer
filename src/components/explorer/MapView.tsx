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
import { STATION_DATA } from "@/data/station-data";
import { TRAFFIC_DATA } from "@/data/traffic-data";
import { REGION_DEMOGRAPHICS } from "@/data/demographic-data";
import { computeStationOpportunities, computeAllStationSignals, fmt as fmtNumber } from "@/lib/opportunity-scoring";
import type { StationOpportunity, SignalProfile, ConfidenceLevel } from "@/lib/opportunity-scoring";

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
  activeLayers?: ReadonlySet<LayerId>;
  trafficOptions?: TrafficLayerOptions;
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

// --- Demographic colors ---

const INCOME_COLORS = [
  "#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#e0e7ff",
  "#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a",
];

const IMD_SCORES = REGION_DEMOGRAPHICS.map(d => d.avgImdScore);
const IMD_MIN = Math.min(...IMD_SCORES);
const IMD_MAX = Math.max(...IMD_SCORES);

function imdColor(score: number): string {
  const t = Math.max(0, Math.min(1, (score - IMD_MIN) / (IMD_MAX - IMD_MIN || 1)));
  return `rgb(${Math.round(34 + t * 205)},${Math.round(197 - t * 129)},${Math.round(94 - t * 26)})`;
}

const DEMO_BY_REGION = new Map(REGION_DEMOGRAPHICS.map((d) => [d.region, d]));

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

const TRAFFIC_LEGEND: LayerLegendConfig = {
  type: "gradient",
  label: "Daily road traffic",
  colors: ["#16a34a", "#facc15", "#f97316", "#dc2626"],
  min: "25K",
  max: "200K+",
};


const INCOME_LEGEND: LayerLegendConfig = {
  type: "gradient",
  label: "Income level (decile)",
  colors: ["#7c3aed", "#a78bfa", "#e0e7ff", "#86efac", "#16a34a"],
  min: "Low",
  max: "High",
};

const IMD_LEGEND: LayerLegendConfig = {
  type: "gradient",
  label: "Deprivation index",
  colors: ["#22c55e", "#86efac", "#fde68a", "#f87171", "#ef4444"],
  min: "Low",
  max: "High",
};

const MapView = ({ selectedBrands, metric, display, selectedRegion, onRegionSelect, topoData, visibleIndices, activeLayers = EMPTY_LAYERS, trafficOptions }: MapViewProps) => {
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
  const trafficHeatRef = useRef<L.Layer | null>(null);
  const demoAppliedRef = useRef(false);
  const demoSavedStylesRef = useRef<Map<any, any>>(new Map());
  // Stores the active demographic styles per region name so hover handlers can restore them
  const demoActiveStylesRef = useRef<Map<string, any>>(new Map());
  const brandDimmedRef = useRef(false);

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

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
    }).setView(mapCenter, mapZoom);

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
    map.getPane("pointsPane")!.style.zIndex = "450";

    map.createPane("regionInteractionPane");
    map.getPane("regionInteractionPane")!.style.zIndex = "600";

    // Overlay panes
    map.createPane("trafficPane");
    map.getPane("trafficPane")!.style.zIndex = "440";
    map.createPane("stationPane");
    map.getPane("stationPane")!.style.zIndex = "610";

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

  // Swap tile URLs when theme changes
  useEffect(() => {
    const urls = getTileUrls(resolvedTheme);
    if (baseTileRef.current) baseTileRef.current.setUrl(urls.base);
    if (labelTileRef.current) labelTileRef.current.setUrl(urls.labels);
  }, [resolvedTheme]);

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
                  const demoStyle = demoAppliedRef.current ? demoActiveStylesRef.current.get(feature.properties.name) : null;
                  if (demoStyle) {
                    e.target.setStyle({ weight: 2.5, color: "#60a5fa", fillColor: demoStyle.fillColor, fillOpacity: 0.8 });
                  } else {
                    e.target.setStyle({ weight: 2.5, color: "#60a5fa" });
                  }
                  e.target.bringToFront();
                  if (!demoAppliedRef.current) showTooltip(feature, e);
                },
                mousemove: (e: L.LeafletMouseEvent) => { if (!demoAppliedRef.current) moveTooltip(e); },
                mouseout: (e: L.LeafletMouseEvent) => {
                  const demoStyle = demoAppliedRef.current ? demoActiveStylesRef.current.get(feature.properties.name) : null;
                  if (demoStyle) {
                    e.target.setStyle(demoStyle);
                  } else {
                    visualLayer.resetStyle(e.target);
                  }
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
                // When demographic overlay is active, use its fillColor with a brighter highlight
                const demoStyle = demoAppliedRef.current ? demoActiveStylesRef.current.get(feature.properties.name) : null;
                if (demoStyle) {
                  vl.setStyle({ weight: 2.5, color: "#60a5fa", fillColor: demoStyle.fillColor, fillOpacity: 0.8, dashArray: "" });
                } else {
                  vl.setStyle({ weight: 2.5, color: "#60a5fa", fillOpacity: hoverFillOpacity, dashArray: "" });
                }
              }
              if (!demoAppliedRef.current) showTooltip(feature, e);
            },
            mousemove: (e: L.LeafletMouseEvent) => { if (!demoAppliedRef.current) moveTooltip(e); },
            mouseout: () => {
              const vl = visualLayerIndex.get(feature.properties.name);
              if (vl) {
                // When demographic overlay is active, restore demographic style instead of resetting
                const demoStyle = demoAppliedRef.current ? demoActiveStylesRef.current.get(feature.properties.name) : null;
                if (demoStyle) {
                  vl.setStyle(demoStyle);
                } else {
                  visualLayer.resetStyle(vl);
                }
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

  // Update points
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(pointLayersRef.current).forEach((lg) => map.removeLayer(lg));
    pointLayersRef.current = {};

    if (display === "points" || display === "both") {
      const zoom = map.getZoom();
      const radius = getMarkerRadius(zoom);
      const opacity = brandDimmedRef.current ? 0.18 : getMarkerOpacity(zoom);

      const sortedBrands = [...selectedBrands].sort(
        (a, b) => (BRAND_POINTS[a] || []).length - (BRAND_POINTS[b] || []).length
      );

      const allMarkers: L.CircleMarker[] = [];

      sortedBrands.forEach((brand) => {
        const pts = BRAND_POINTS[brand] || [];
        const vis = visibleIndices?.[brand];
        const indexedPts = pts.map((p, i) => ({ p, i }));
        const filtered = vis ? indexedPts.filter(({ i }) => vis.has(i)) : indexedPts;
        const markers = filtered.map(({ p, i: origIdx }) => {
          const attrs = brandAttributes?.[brand]?.[origIdx];
          const marker = L.circleMarker([p[0], p[1]], {
            radius,
            fillColor: BRANDS[brand].color,
            color: "rgba(15,17,30,0.5)",
            weight: 1,
            fillOpacity: opacity,
            pane: "pointsPane",
          });
          const html = buildPopupHtml(brand, p, attrs);
          if (display === "choropleth") {
            marker.bindPopup(html);
          } else {
            marker.bindTooltip(html, { direction: "top", offset: [0, -8] });
          }
          allMarkers.push(marker);
          return marker;
        });
        pointLayersRef.current[brand] = L.layerGroup(markers).addTo(map);
      });

      const onZoomEnd = () => {
        const z = map.getZoom();
        const r = getMarkerRadius(z);
        const o = brandDimmedRef.current ? 0.18 : getMarkerOpacity(z);
        allMarkers.forEach((m) => { m.setRadius(r); m.setStyle({ fillOpacity: o }); });
      };
      map.on("zoomend", onZoomEnd);
      return () => { map.off("zoomend", onZoomEnd); };
    }
  }, [selectedBrands, display, visibleIndices, BRAND_POINTS, BRANDS, brandAttributes]);

  // Dim brand markers when station analysis overlay is active
  useEffect(() => {
    const dimmed = activeLayers.has("stationAnalysis") && (display === "points" || display === "both");
    brandDimmedRef.current = dimmed;
    const targetOpacity = dimmed ? 0.18 : getMarkerOpacity(mapRef.current?.getZoom() ?? 8);
    Object.values(pointLayersRef.current).forEach((lg) => {
      lg.eachLayer((layer) => {
        (layer as L.CircleMarker).setStyle({ fillOpacity: targetOpacity });
      });
    });
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

    const markers: L.Marker[] = [];
    const maxEntries = STATION_DATA[0]?.annualEntries || 1;
    const walkMin = Math.round((0.8 * 1.35) / 5 * 60);

    for (const station of STATION_DATA) {
      if (station.annualEntries < 500_000) continue;

      const opp = oppByStation.get(station.name);
      const ratio = station.annualEntries / maxEntries;
      const radius = 3 + ratio * 9;
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
      marker.on("click", () => onRegionSelect(station.region));
      markers.push(marker);
    }

    stationAnalysisRef.current = L.layerGroup(markers).addTo(map);

    return () => {
      if (stationAnalysisRef.current) { map.removeLayer(stationAnalysisRef.current); stationAnalysisRef.current = null; }
    };
  }, [activeLayers.has("stationAnalysis"), oppByStation]);

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

  // Opportunity hotspots overlay
  // Demographic overlay (income / IMD)
  const hasDemoIncome = activeLayers.has("demographicIncome");
  const hasDemoImd = activeLayers.has("demographicImd");

  useEffect(() => {
    const regionLayer = regionLayerRef.current;
    if (!regionLayer) return;

    // Remove previous demographic styling
    if (demoAppliedRef.current) {
      regionLayer.eachLayer((layer: any) => {
        layer.unbindTooltip();
        const saved = demoSavedStylesRef.current.get(layer);
        if (saved) layer.setStyle(saved);
      });
      demoSavedStylesRef.current.clear();
      demoActiveStylesRef.current.clear();
      demoAppliedRef.current = false;
    }

    if (!hasDemoIncome && !hasDemoImd) return;

    const mode = hasDemoIncome ? "income" : "imd";

    regionLayer.eachLayer((layer: any) => {
      const name = layer.feature?.properties?.name;
      if (!name) return;
      const demo = DEMO_BY_REGION.get(name);
      if (!demo) return;

      // Save original style before override
      const opts = layer.options || {};
      demoSavedStylesRef.current.set(layer, {
        fillColor: opts.fillColor ?? "transparent",
        fillOpacity: opts.fillOpacity ?? 0.05,
        weight: opts.weight ?? 1.5,
        color: opts.color ?? "rgba(100, 116, 139, 0.4)",
        dashArray: opts.dashArray ?? "5 3",
      });

      layer.unbindTooltip();

      let demoStyle: any;
      if (mode === "income") {
        const idx = Math.max(0, Math.min(9, demo.medianIncomeDecile - 1));
        demoStyle = { fillColor: INCOME_COLORS[idx], fillOpacity: 0.6, weight: 1.5, color: "#3a3f52", dashArray: "" };
      } else {
        demoStyle = { fillColor: imdColor(demo.avgImdScore), fillOpacity: 0.6, weight: 1.5, color: "#3a3f52", dashArray: "" };
      }
      layer.setStyle(demoStyle);
      // Store so hover handlers can restore this style on mouseout
      demoActiveStylesRef.current.set(name, demoStyle);

      layer.bindTooltip(`<div style="font-size:12px">
        <div style="font-weight:700;margin-bottom:4px">${escapeHtml(name)}</div>
        <div>Income decile: <strong>${demo.medianIncomeDecile}</strong>/10</div>
        <div>Deprivation score: <strong>${demo.avgImdScore.toFixed(1)}</strong></div>
        <div>Employment: <strong>${(demo.avgEmploymentScore * 100).toFixed(1)}%</strong></div>
        <div style="font-size:10px;color:#94a3b8;margin-top:2px">${demo.lsoaCount.toLocaleString()} ${demo.microAreaLabel} (${demo.deprivationSource})</div>
      </div>`, { sticky: true });
    });

    demoAppliedRef.current = true;
  }, [hasDemoIncome, hasDemoImd, topoData, display]);

  // Build overlay legends
  const overlayLegends = useMemo(() => {
    const items: { id: string; config: LayerLegendConfig }[] = [];
    if (activeLayers.has("stationAnalysis")) items.push({ id: "stationAnalysis", config: STATION_ANALYSIS_LEGEND });
    if (activeLayers.has("traffic")) items.push({ id: "traffic", config: TRAFFIC_LEGEND });
    if (hasDemoIncome) items.push({ id: "demographicIncome", config: INCOME_LEGEND });
    if (hasDemoImd) items.push({ id: "demographicImd", config: IMD_LEGEND });
    return items;
  }, [activeLayers, hasDemoIncome, hasDemoImd]);

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
