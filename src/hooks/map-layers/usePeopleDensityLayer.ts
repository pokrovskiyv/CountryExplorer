import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import { STATION_DATA } from "@/data/station-data"
import type { LayerLegendConfig } from "./types"

type WorkplacePoint = readonly [number, number, number]

const LEGEND: LayerLegendConfig = {
  type: "gradient",
  label: "People density (workers + passengers)",
  colors: ["#1e3a5f", "#0891b2", "#06b6d4", "#fbbf24", "#f97316"],
  min: "<1K",
  max: "90K+",
}

export function usePeopleDensityLayer(
  mapRef: React.MutableRefObject<L.Map | null>,
  isActive: boolean,
): LayerLegendConfig | null {
  const layerRef = useRef<L.Layer | null>(null)
  const [wpData, setWpData] = useState<readonly WorkplacePoint[] | null>(null)

  // Lazy-load workplace population data on first activation
  useEffect(() => {
    if (!isActive || wpData) return
    import("@/data/workplace-pop-data").then((m) => {
      setWpData(m.WORKPLACE_POP)
    })
  }, [isActive, wpData])

  // Create heatmap layer
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isActive || !wpData) return

    // Build combined heat points: stations (footfall) + MSOA (workplace pop)
    const heatPoints: [number, number, number][] = []

    // Station footfall — log-normalized
    const maxLogFootfall = Math.log(Math.max(1, ...STATION_DATA.map((s) => s.annualEntries)))
    for (const station of STATION_DATA) {
      if (station.annualEntries <= 0) continue
      const intensity = Math.log(station.annualEntries) / maxLogFootfall
      heatPoints.push([station.lat, station.lon, intensity])
    }

    // Workplace population — log-normalized
    const maxLogWp = Math.log(Math.max(1, ...wpData.map((p) => p[2])))
    for (const point of wpData) {
      const intensity = Math.log(Math.max(1, point[2])) / maxLogWp
      // Workplace points weighted slightly lower than station footfall
      // to avoid overwhelming station signals
      heatPoints.push([point[0], point[1], intensity * 0.6])
    }

    // Render below region polygons (overlayPane z=400) so clicks reach regions
    if (!map.getPane("peopleDensityPane")) {
      const pane = map.createPane("peopleDensityPane")
      pane.style.zIndex = "398"
      pane.style.pointerEvents = "none"
    }

    const heat = (L as any).heatLayer(heatPoints, {
      radius: 25,
      blur: 18,
      maxZoom: 12,
      max: 1.0,
      minOpacity: 0.25,
      pane: "peopleDensityPane",
      gradient: {
        0.15: "#1e3a5f",
        0.35: "#0891b2",
        0.55: "#06b6d4",
        0.75: "#fbbf24",
        1.0: "#f97316",
      },
    })

    heat.addTo(map)

    layerRef.current = heat

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [isActive, wpData])

  return isActive ? LEGEND : null
}
