import { useState, useCallback, useRef, useEffect } from "react"
import type { LayerId, TrafficLayerOptions } from "@/hooks/map-layers/types"
import type { ContextTarget } from "@/components/explorer/ContextPanel"
import type { PanelState } from "./intelligence/types"
import MapView from "./MapView"
import IntelligencePanel from "./intelligence/IntelligencePanel"
import KpiStrip from "./intelligence/KpiStrip"
import { useMultiAnchorOpportunities } from "@/hooks/useMultiAnchorOpportunities"
import { useCountry } from "@/contexts/CountryContext"

type Metric = "total" | "density" | "share"
type Display = "choropleth" | "points" | "both" | "heatmap"

interface SmartMapViewProps {
  selectedBrands: Set<string>
  perspectiveBrand: string | null
  onPerspectiveChange: (brand: string | null) => void
  metric: Metric
  display: Display
  selectedRegion: string | null
  onRegionSelect: (name: string) => void
  topoData: any
  visibleIndices?: Record<string, ReadonlySet<number>>
  activeLayers?: ReadonlySet<LayerId>
  trafficOptions?: TrafficLayerOptions
  initialCenter?: [number, number]
  initialZoom?: number
  onMapPositionChange?: (center: [number, number], zoom: number) => void
  onContextTarget?: (target: ContextTarget) => void
  mapStyle?: "default" | "satellite"
  pendingFlyToRegion?: string | null
  onFlyToComplete?: () => void
}

const SmartMapView = ({
  selectedBrands,
  perspectiveBrand,
  onPerspectiveChange,
  metric,
  display,
  selectedRegion,
  onRegionSelect,
  topoData,
  visibleIndices,
  activeLayers,
  trafficOptions,
  initialCenter,
  initialZoom,
  onMapPositionChange,
  onContextTarget,
  mapStyle,
  pendingFlyToRegion,
  onFlyToComplete,
}: SmartMapViewProps) => {
  const [panelState, setPanelState] = useState<PanelState>({ mode: "overview" })
  const [highlightedStation, setHighlightedStation] = useState<string | null>(null)
  const previousBoundsRef = useRef<{ center: [number, number]; zoom: number } | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const previewCircleRef = useRef<L.Circle | null>(null)
  const previewMarkerRef = useRef<L.Marker | null>(null)
  const previewOppIdRef = useRef<string | null>(null)
  const selectRef = useRef<((id: string) => void) | null>(null)

  const handleMapReady = useCallback((map: L.Map) => {
    mapInstanceRef.current = map
  }, [])

  const { regionCentroids } = useCountry()

  // Fly to region when insight "Show on map" is clicked
  useEffect(() => {
    if (!pendingFlyToRegion || !mapInstanceRef.current) return
    const coords = regionCentroids[pendingFlyToRegion]
    if (coords) {
      mapInstanceRef.current.setView(coords, 9, { animate: true })
    }
    onFlyToComplete?.()
  }, [pendingFlyToRegion, regionCentroids, onFlyToComplete])

  const {
    opportunities,
    stationOpps,
    junctionOpps,
    msoaOpps,
    kpis,
    narrative,
    brandIntelligence,
    brandLabel,
    anchorFilter,
    setAnchorFilter,
  } = useMultiAnchorOpportunities(perspectiveBrand)

  const clearPreview = useCallback(() => {
    if (previewCircleRef.current) {
      previewCircleRef.current.remove()
      previewCircleRef.current = null
    }
    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove()
      previewMarkerRef.current = null
    }
    previewOppIdRef.current = null
  }, [])

  const saveBounds = useCallback(() => {
    if (mapInstanceRef.current) {
      previousBoundsRef.current = {
        center: [mapInstanceRef.current.getCenter().lat, mapInstanceRef.current.getCenter().lng],
        zoom: mapInstanceRef.current.getZoom(),
      }
    }
  }, [])

  const handleRegionSelect = useCallback((name: string) => {
    onRegionSelect(name) // update Explorer's selectedRegion for map highlight
    setPanelState({ mode: "region", regionName: name })
  }, [onRegionSelect])

  const handleStationSelect = useCallback((stationName: string) => {
    mapInstanceRef.current?.closePopup()
    saveBounds()
    setPanelState({ mode: "station", stationName })
  }, [saveBounds])

  const handleJunctionSelect = useCallback((junctionId: string) => {
    mapInstanceRef.current?.closePopup()
    saveBounds()
    setPanelState({ mode: "junction", junctionId })
  }, [saveBounds])

  const handleOpportunitySelect = useCallback((id: string) => {
    const opp = opportunities.find((o) => o.id === id)
    if (!opp) return
    mapInstanceRef.current?.closePopup()
    clearPreview()
    saveBounds()
    if (opp.anchorType === "station") {
      setPanelState({ mode: "station", stationName: opp.label })
    } else if (opp.anchorType === "junction") {
      setPanelState({ mode: "junction", junctionId: opp.id })
      // Fly map to junction location
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([opp.lat, opp.lng], Math.max(mapInstanceRef.current.getZoom(), 13), { animate: false })
      }
    } else if (opp.anchorType === "msoa") {
      setPanelState({ mode: "zone", lat: opp.lat, lng: opp.lng, msoaName: opp.label })
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([opp.lat, opp.lng], Math.max(mapInstanceRef.current.getZoom(), 13), { animate: false })
      }
    }
  }, [opportunities, saveBounds])
  selectRef.current = handleOpportunitySelect

  const handleOpportunityFlyTo = useCallback((id: string) => {
    const opp = opportunities.find((o) => o.id === id)
    if (!opp || !mapInstanceRef.current) return
    const map = mapInstanceRef.current
    map.closePopup()
    map.setView([opp.lat, opp.lng], Math.max(map.getZoom(), 13), { animate: false })

    // Show preview highlight — matches anchor type style
    clearPreview()
    previewOppIdRef.current = id
    const L = (window as any).L
    if (!L) return

    const color = opp.anchorType === "msoa" ? "#06b6d4"
      : opp.anchorType === "junction" ? "#6366f1"
      : "#22c55e"
    const radius = opp.anchorType === "msoa" ? 1500 : 800

    const openDeepDive = () => {
      const oppId = previewOppIdRef.current
      if (oppId) selectRef.current?.(oppId)
    }

    previewCircleRef.current = L.circle([opp.lat, opp.lng], {
      radius,
      color,
      weight: 2.5,
      dashArray: "6 4",
      fillColor: color,
      fillOpacity: 0.10,
      interactive: true,
      className: "preview-pulse",
    }).addTo(map)
    previewCircleRef.current.on("click", openDeepDive)

    // Pin marker for zones and junctions (stations already have visible markers)
    if (opp.anchorType !== "station") {
      const sz = 28
      const inner = 10
      const pinIcon = L.divIcon({
        className: "preview-pin-icon",
        html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;border:2.5px solid ${color};background:rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer">
          <div style="width:${inner}px;height:${inner}px;border-radius:50%;background:${color}"></div>
        </div>`,
        iconSize: [sz, sz],
        iconAnchor: [sz / 2, sz / 2],
      })
      previewMarkerRef.current = L.marker([opp.lat, opp.lng], {
        icon: pinIcon,
        pane: "stationPane",
        interactive: true,
      }).addTo(map)
      previewMarkerRef.current.on("click", openDeepDive)
    }
  }, [opportunities, clearPreview])

  const handleZoneSelect = useCallback((target: ContextTarget) => {
    if (target && target.type === "msoa") {
      mapInstanceRef.current?.closePopup()
      saveBounds()
      setPanelState({
        mode: "zone",
        lat: target.lat,
        lng: target.lon,
        msoaName: target.name,
        decile: target.decile,
        source: target.source,
      })
    }
    onContextTarget?.(target)
  }, [onContextTarget, saveBounds])

  const handleBack = useCallback(() => {
    mapInstanceRef.current?.closePopup()
    clearPreview()
    setPanelState({ mode: "overview" })
    if (previousBoundsRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.setView(previousBoundsRef.current.center, previousBoundsRef.current.zoom, { animate: false })
      previousBoundsRef.current = null
    }
  }, [])

  // Zone highlight — circle + pin marker when a zone is selected
  const zoneCircleRef = useRef<L.Circle | null>(null)
  const zoneMarkerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    // Clean up previous zone visuals — .remove() is map-ref-safe
    if (zoneCircleRef.current) {
      zoneCircleRef.current.remove()
      zoneCircleRef.current = null
    }
    if (zoneMarkerRef.current) {
      zoneMarkerRef.current.remove()
      zoneMarkerRef.current = null
    }

    const map = mapInstanceRef.current
    if (!map || panelState.mode !== "zone") return

    const { lat, lng, msoaName } = panelState
    const L = (window as any).L
    if (!L) return

    // 1.5km radius circle (cyan, dashed)
    zoneCircleRef.current = L.circle([lat, lng], {
      radius: 1500,
      color: "#06b6d4",
      weight: 2,
      dashArray: "8 5",
      fillColor: "#06b6d4",
      fillOpacity: 0.06,
      interactive: false,
    }).addTo(map)

    // Pin marker at centroid
    const pinIcon = L.divIcon({
      className: "zone-pin-icon",
      html: `<div style="width:28px;height:28px;border-radius:6px;background:#06b6d4;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })

    zoneMarkerRef.current = L.marker([lat, lng], {
      icon: pinIcon,
      pane: "stationPane",
      interactive: true,
    }).addTo(map)
    zoneMarkerRef.current.bindPopup(
      `<div style="font-family:system-ui"><strong>${msoaName}</strong><br/><span style="color:#888">MSOA Zone</span></div>`,
      { maxWidth: 200 },
    )

    return () => {
      if (zoneCircleRef.current) {
        zoneCircleRef.current.remove()
        zoneCircleRef.current = null
      }
      if (zoneMarkerRef.current) {
        zoneMarkerRef.current.remove()
        zoneMarkerRef.current = null
      }
    }
  }, [panelState])

  // Junction highlight — circle + diamond marker when a junction is selected
  const junctionCircleRef = useRef<L.Circle | null>(null)
  const junctionMarkerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (junctionCircleRef.current) {
      junctionCircleRef.current.remove()
      junctionCircleRef.current = null
    }
    if (junctionMarkerRef.current) {
      junctionMarkerRef.current.remove()
      junctionMarkerRef.current = null
    }

    const map = mapInstanceRef.current
    if (!map || panelState.mode !== "junction") return

    const junction = junctionOpps.find((j) => j.id === panelState.junctionId)
    if (!junction) return

    const L = (window as any).L
    if (!L) return

    // 1.5km radius circle (indigo, dashed)
    junctionCircleRef.current = L.circle([junction.lat, junction.lng], {
      radius: 1500,
      color: "#6366f1",
      weight: 2,
      dashArray: "8 5",
      fillColor: "#6366f1",
      fillOpacity: 0.06,
      interactive: false,
    }).addTo(map)

    // Diamond marker at junction location
    const sz = 28
    const diamondIcon = L.divIcon({
      className: "junction-focus-icon",
      html: `<div style="width:${sz}px;height:${sz}px;transform:rotate(45deg);border-radius:4px;background:#6366f1;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4)">
        <svg style="transform:rotate(-45deg)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>`,
      iconSize: [sz, sz],
      iconAnchor: [sz / 2, sz / 2],
    })

    junctionMarkerRef.current = L.marker([junction.lat, junction.lng], {
      icon: diamondIcon,
      pane: "stationPane",
      interactive: true,
    }).addTo(map)
    junctionMarkerRef.current.bindPopup(
      `<div style="font-family:system-ui"><strong>${junction.trafficPoint.roadName}</strong><br/><span style="color:#888">${junction.region} · Junction</span></div>`,
      { maxWidth: 200 },
    )

    return () => {
      if (junctionCircleRef.current) {
        junctionCircleRef.current.remove()
        junctionCircleRef.current = null
      }
      if (junctionMarkerRef.current) {
        junctionMarkerRef.current.remove()
        junctionMarkerRef.current = null
      }
    }
  }, [panelState, junctionOpps])

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-[3] relative min-w-0 flex flex-col">
        <KpiStrip
          opportunities={opportunities}
          kpis={kpis}
          brandLabel={brandLabel}
          anchorFilter={anchorFilter}
        />
        <MapView
          selectedBrands={selectedBrands}
          perspectiveBrand={perspectiveBrand}
          metric={metric}
          display={display}
          selectedRegion={selectedRegion}
          onRegionSelect={handleRegionSelect}
          topoData={topoData}
          visibleIndices={visibleIndices}
          activeLayers={activeLayers}
          trafficOptions={trafficOptions}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          onMapPositionChange={onMapPositionChange}
          onContextTarget={handleZoneSelect}
          variant="smart-map"
          onStationSelect={handleStationSelect}
          highlightedStation={highlightedStation}
          focusedStation={panelState.mode === "station" ? panelState.stationName : null}
          onMapReady={handleMapReady}
          junctionOpportunities={anchorFilter === "station" ? undefined : junctionOpps}
          onJunctionSelect={handleJunctionSelect}
          zoneOpportunities={anchorFilter === "junction" ? undefined : msoaOpps}
          onZoneSelect={handleOpportunitySelect}
          mapStyle={mapStyle}
        />
      </div>
      <IntelligencePanel
        panelState={panelState}
        opportunities={opportunities}
        stationOpps={stationOpps}
        junctionOpps={junctionOpps}
        totalCounts={{ stations: stationOpps.length, junctions: junctionOpps.length, zones: msoaOpps.length }}
        kpis={kpis}
        narrative={narrative}
        brandIntelligence={brandIntelligence}
        brandLabel={brandLabel}
        selectedBrands={selectedBrands}
        perspectiveBrand={perspectiveBrand}
        onPerspectiveChange={onPerspectiveChange}
        anchorFilter={anchorFilter}
        onAnchorFilterChange={setAnchorFilter}
        onOpportunitySelect={handleOpportunitySelect}
        onOpportunityFlyTo={handleOpportunityFlyTo}
        onBack={handleBack}
        highlightedStation={highlightedStation}
        onHighlightStation={setHighlightedStation}
      />
    </div>
  )
}

export default SmartMapView
