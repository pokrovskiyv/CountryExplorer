import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import * as topojson from "topojson-client"
import type { LayerLegendConfig } from "./types"

/** Salary gradient: cool blue (low) → warm green (high) */
function salaryColor(salary: number): string {
  // Range: ~£23K to ~£35K
  const min = 23000
  const max = 35000
  const t = Math.max(0, Math.min(1, (salary - min) / (max - min)))
  const r = Math.round(124 - t * 90)
  const g = Math.round(58 + t * 139)
  const b = Math.round(237 - t * 143)
  return `rgb(${r},${g},${b})`
}

function formatSalary(salary: number): string {
  return `£${Math.round(salary / 1000)}K`
}

const LEGEND: LayerLegendConfig = {
  type: "gradient",
  label: "Estimated income (annual)",
  colors: ["#7c3aed", "#6366f1", "#3b82f6", "#22c55e", "#16a34a"],
  min: "£23K",
  max: "£35K",
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

    const layer = L.geoJSON(geojsonData, {
      pane: "demographicIncomePane",
      style: (feature) => {
        const props = feature?.properties as MsoaSalaryProperties | undefined
        const salary = props?.sal ?? 28000
        return {
          fillColor: salaryColor(salary),
          fillOpacity: 0.65,
          weight: 0.5,
          color: "#64748b",
          opacity: 0.4,
        }
      },
      onEachFeature: (feature, featureLayer) => {
        const props = feature.properties as MsoaSalaryProperties
        featureLayer.bindTooltip(
          `<div style="font-size:12px">` +
          `<div style="font-weight:600;margin-bottom:2px">${props.n}</div>` +
          `<div>Estimated income: <strong>${formatSalary(props.sal)}</strong>/year</div>` +
          `<div>Decile: <strong>${props.d}</strong>/10</div>` +
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
  }, [isActive, geojsonData])

  return isActive ? LEGEND : null
}
