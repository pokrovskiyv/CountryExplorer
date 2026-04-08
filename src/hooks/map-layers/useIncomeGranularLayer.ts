import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import * as topojson from "topojson-client"
import type { LayerLegendConfig } from "./types"

/** Decile-based palette: purple (lowest 10%) → green (highest 10%).
 * 10 discrete buckets so equal-ranked MSOAs get the same shade regardless
 * of absolute £ value — gives much better visual contrast than interpolating
 * a narrow £23K-£35K range. */
const DECILE_COLORS: readonly string[] = [
  "#6d28d9", // 1 — lowest decile
  "#7c3aed",
  "#6366f1",
  "#4f46e5",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#22c55e",
  "#16a34a",
  "#15803d", // 10 — highest decile
]

function decileColor(decile: number): string {
  const idx = Math.max(1, Math.min(10, Math.round(decile))) - 1
  return DECILE_COLORS[idx]
}

function formatSalary(salary: number): string {
  return `£${Math.round(salary / 1000)}K`
}

const LEGEND: LayerLegendConfig = {
  type: "gradient",
  label: "Income (by decile)",
  colors: ["#6d28d9", "#4f46e5", "#3b82f6", "#10b981", "#15803d"],
  min: "Low income",
  max: "High income",
}

const TOPO_URL = "/msoa-salary-topo.json"

interface MsoaSalaryProperties {
  c: string   // MSOA code
  n: string   // MSOA name
  sal: number // estimated annual salary in pounds
  d: number   // salary decile 1-10
  la: string  // Local Authority name
}

export function useIncomeGranularLayer(
  mapRef: React.MutableRefObject<L.Map | null>,
  isActive: boolean,
  mapStyle: "default" | "satellite" = "default",
): LayerLegendConfig | null {
  const layerRef = useRef<L.GeoJSON | null>(null)
  const [geojsonData, setGeojsonData] = useState<GeoJSON.FeatureCollection | null>(null)

  // Lazy-load TopoJSON on first activation
  useEffect(() => {
    if (!isActive || geojsonData) return
    let cancelled = false
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return
        const objectKey = Object.keys(topo.objects)[0]
        const fc = topojson.feature(topo, topo.objects[objectKey]) as unknown as GeoJSON.FeatureCollection
        setGeojsonData(fc)
      })
      .catch((err) => {
        console.error("Failed to load MSOA salary data:", err)
      })
    return () => { cancelled = true }
  }, [isActive, geojsonData])

  // Render GeoJSON polygon layer
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isActive || !geojsonData) return

    if (!map.getPane("demographicIncomePane")) {
      map.createPane("demographicIncomePane")
      map.getPane("demographicIncomePane")!.style.zIndex = "435"
    }

    const isSatellite = mapStyle === "satellite"
    const layer = L.geoJSON(geojsonData, {
      pane: "demographicIncomePane",
      style: (feature) => {
        const props = feature?.properties as MsoaSalaryProperties | undefined
        const decile = props?.d ?? 5
        return {
          fillColor: decileColor(decile),
          fillOpacity: isSatellite ? 0.8 : 0.65,
          weight: 1,
          color: isSatellite ? "#ffffff" : "#64748b",
          opacity: isSatellite ? 0.5 : 0.4,
        }
      },
      onEachFeature: (feature, featureLayer) => {
        const props = feature.properties as MsoaSalaryProperties
        featureLayer.bindTooltip(
          `<div style="font-size:12px">` +
          `<div style="font-weight:600;margin-bottom:2px">${props.n}</div>` +
          `<div>Income decile: <strong>${props.d}</strong>/10</div>` +
          `<div>Estimated: <strong>${formatSalary(props.sal)}</strong>/year</div>` +
          `<div style="font-size:10px;color:#94a3b8;margin-top:2px">${props.la} (BRES + ASHE 2023)</div>` +
          `</div>`,
          { sticky: true },
        )
      },
    }).addTo(map)

    layerRef.current = layer

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [isActive, geojsonData, mapStyle])

  return isActive ? LEGEND : null
}
