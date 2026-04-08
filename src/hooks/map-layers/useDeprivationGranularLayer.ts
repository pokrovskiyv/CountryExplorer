import { useCallback, useEffect, useRef, useState } from "react"
import L from "leaflet"
import * as topojson from "topojson-client"
import type { LayerLegendConfig } from "./types"

function deprivationColor(normalizedScore: number): string {
  const t = Math.max(0, Math.min(1, normalizedScore / 100))
  const r = Math.round(191 - t * 115)
  const g = Math.round(219 - t * 190)
  const b = Math.round(254 - t * 105)
  return `rgb(${r},${g},${b})`
}

const LEGEND: LayerLegendConfig = {
  type: "gradient",
  label: "Deprivation (MSOA level)",
  colors: ["#bfdbfe", "#a5b4fc", "#8b5cf6", "#7c3aed", "#4c1d95"],
  min: "0",
  max: "100",
}

const TOPO_URL = "/msoa-deprivation-topo.json"

interface MsoaProperties {
  c: string   // MSOA code
  n: string   // MSOA name
  s: number   // normalized score 0-100
  d: number   // decile 1-10
  src: string // data source label
}

export interface MsoaClickEvent {
  readonly lat: number
  readonly lon: number
  readonly name: string
  readonly score: number
  readonly decile: number
  readonly source: string
}

export function useDeprivationGranularLayer(
  mapRef: React.MutableRefObject<L.Map | null>,
  isActive: boolean,
  onFeatureClick?: (event: MsoaClickEvent) => void,
  mapStyle: "default" | "satellite" = "default",
): LayerLegendConfig | null {
  const layerRef = useRef<L.GeoJSON | null>(null)
  const clickRef = useRef(onFeatureClick)
  clickRef.current = onFeatureClick
  const [geojsonData, setGeojsonData] = useState<GeoJSON.FeatureCollection | null>(null)

  // Lazy-load TopoJSON on first activation, convert to GeoJSON
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
        console.error("Failed to load MSOA deprivation data:", err)
      })
    return () => { cancelled = true }
  }, [isActive, geojsonData])

  // Render GeoJSON polygon layer
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isActive || !geojsonData) return

    if (!map.getPane("demographicImdPane")) {
      map.createPane("demographicImdPane")
      map.getPane("demographicImdPane")!.style.zIndex = "435"
    }

    const isSatellite = mapStyle === "satellite"
    const layer = L.geoJSON(geojsonData, {
      pane: "demographicImdPane",
      style: (feature) => {
        const props = feature?.properties as MsoaProperties | undefined
        const score = props?.s ?? 50
        return {
          fillColor: deprivationColor(score),
          fillOpacity: isSatellite ? 0.8 : 0.65,
          weight: 1,
          color: isSatellite ? "#ffffff" : "#64748b",
          opacity: isSatellite ? 0.5 : 0.4,
        }
      },
      onEachFeature: (feature, featureLayer) => {
        const props = feature.properties as MsoaProperties
        featureLayer.bindTooltip(
          `<div style="font-size:12px">` +
          `<div style="font-weight:600;margin-bottom:2px">${props.n}</div>` +
          `<div>Deprivation: <strong>${props.s.toFixed(0)}</strong>/100</div>` +
          `<div>Decile: <strong>${props.d}</strong>/10</div>` +
          `<div style="font-size:10px;color:#94a3b8;margin-top:2px">${props.src}</div>` +
          `</div>`,
          { sticky: true },
        )
        featureLayer.on("click", (e: L.LeafletMouseEvent) => {
          clickRef.current?.({
            lat: e.latlng.lat,
            lon: e.latlng.lng,
            name: props.n,
            score: props.s,
            decile: props.d,
            source: props.src,
          })
        })
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
