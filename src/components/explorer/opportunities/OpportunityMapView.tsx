// Opportunity Map — lightweight Leaflet map showing station opportunity markers
// Split-view left panel: colored markers by confidence, sized by score

import { useEffect, useRef, useCallback } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { useResolvedTheme, getTileUrls } from "@/hooks/useResolvedTheme"
import type { StationOpportunity } from "@/lib/opportunity-scoring"

interface OpportunityMapViewProps {
  readonly stations: readonly StationOpportunity[]
  readonly highlightedStation: string | null
  readonly onStationClick: (stationName: string) => void
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#6b7280",
}

function markerRadius(score: number): number {
  return 5 + (score / 100) * 9
}

const OpportunityMapView = ({ stations, highlightedStation, onStationClick }: OpportunityMapViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map())
  const baseTileRef = useRef<L.TileLayer | null>(null)
  const labelTileRef = useRef<L.TileLayer | null>(null)
  const resolvedTheme = useResolvedTheme()

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
    }).setView([54.0, -2.5], 6)

    const urls = getTileUrls(resolvedTheme)
    baseTileRef.current = L.tileLayer(urls.base, {
      subdomains: "abcd",
      maxZoom: 18,
    }).addTo(map)

    labelTileRef.current = L.tileLayer(urls.labels, {
      subdomains: "abcd",
      maxZoom: 18,
      pane: "shadowPane",
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update theme tiles
  useEffect(() => {
    if (!baseTileRef.current || !labelTileRef.current) return
    const urls = getTileUrls(resolvedTheme)
    baseTileRef.current.setUrl(urls.base)
    labelTileRef.current.setUrl(urls.labels)
  }, [resolvedTheme])

  // Render markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current.clear()

    for (const opp of stations) {
      const color = CONFIDENCE_COLORS[opp.confidence] ?? "#6b7280"
      const radius = markerRadius(opp.compositeScore)

      const marker = L.circleMarker([opp.station.lat, opp.station.lon], {
        radius,
        fillColor: color,
        fillOpacity: 0.7,
        color: color,
        weight: 1.5,
        opacity: 0.9,
      }).addTo(map)

      marker.bindTooltip(
        `<div style="font-size:11px;line-height:1.3">
          <strong>${opp.station.name}</strong><br/>
          Score: <strong>${opp.compositeScore}</strong> · ${opp.brandGaps.length} brand gap${opp.brandGaps.length !== 1 ? "s" : ""}<br/>
          <span style="opacity:0.7">${opp.station.region}</span>
        </div>`,
        { direction: "top", offset: [0, -radius] },
      )

      marker.on("click", () => onStationClick(opp.station.name))

      markersRef.current.set(opp.station.name, marker)
    }
  }, [stations, onStationClick])

  // Highlight station: fly to + pulse
  useEffect(() => {
    const map = mapRef.current
    if (!map || !highlightedStation) return

    const marker = markersRef.current.get(highlightedStation)
    if (!marker) return

    const latlng = marker.getLatLng()
    map.flyTo(latlng, Math.max(map.getZoom(), 11), { duration: 0.6 })

    // Pulse effect
    const origRadius = marker.getRadius()
    marker.setRadius(origRadius + 6)
    marker.setStyle({ weight: 3, opacity: 1 })
    const timer = setTimeout(() => {
      marker.setRadius(origRadius)
      marker.setStyle({ weight: 1.5, opacity: 0.9 })
    }, 800)

    return () => clearTimeout(timer)
  }, [highlightedStation])

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg overflow-hidden border border-border"
      style={{ minHeight: 400 }}
    />
  )
}

export default OpportunityMapView
