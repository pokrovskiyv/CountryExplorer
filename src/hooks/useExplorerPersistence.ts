import { useState, useEffect, useRef } from "react"
import type { LayerId, TrafficLayerOptions } from "@/hooks/map-layers/types"

// --- Types ---

type Metric = "total" | "density" | "share"
type Display = "choropleth" | "points" | "both" | "heatmap"

interface PersistedFilters {
  readonly metric: Metric
  readonly display: Display
  readonly activeLayers: readonly LayerId[]
  readonly trafficOptions: TrafficLayerOptions
  readonly selectedBrands: readonly string[]
  readonly perspectiveBrand: string | null
}

export interface PersistedMapPosition {
  readonly center: [number, number]
  readonly zoom: number
}

// --- Constants ---

const FILTERS_KEY = "explorer-filters"
const MAP_POSITION_KEY = "explorer-map-position"

const VALID_METRICS = new Set<Metric>(["total", "density", "share"])
const VALID_DISPLAYS = new Set<Display>(["choropleth", "points", "both", "heatmap"])
const VALID_LAYERS = new Set<LayerId>(["stationAnalysis", "traffic", "demographicIncome", "demographicImd"])

// --- Load / save helpers ---

function loadFilters(allBrandKeys: readonly string[]): PersistedFilters | null {
  try {
    const raw = localStorage.getItem(FILTERS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedFilters

    const metric = VALID_METRICS.has(parsed.metric) ? parsed.metric : null
    const display = VALID_DISPLAYS.has(parsed.display) ? parsed.display : null
    if (!metric || !display) return null

    const activeLayers = Array.isArray(parsed.activeLayers)
      ? parsed.activeLayers.filter((id) => VALID_LAYERS.has(id))
      : []

    const brandSet = new Set(allBrandKeys)
    const selectedBrands = Array.isArray(parsed.selectedBrands)
      ? parsed.selectedBrands.filter((b) => brandSet.has(b))
      : []

    const perspectiveBrand =
      typeof parsed.perspectiveBrand === "string" && brandSet.has(parsed.perspectiveBrand)
        ? parsed.perspectiveBrand
        : null

    return {
      metric,
      display,
      activeLayers,
      trafficOptions: parsed.trafficOptions ?? {},
      selectedBrands: selectedBrands.length > 0 ? selectedBrands : [...allBrandKeys],
      perspectiveBrand,
    }
  } catch {
    return null
  }
}

function saveFilters(filters: PersistedFilters): void {
  localStorage.setItem(FILTERS_KEY, JSON.stringify(filters))
}

export function loadMapPosition(): PersistedMapPosition | null {
  try {
    const raw = localStorage.getItem(MAP_POSITION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedMapPosition
    if (
      !Array.isArray(parsed.center) ||
      parsed.center.length !== 2 ||
      typeof parsed.center[0] !== "number" ||
      typeof parsed.center[1] !== "number" ||
      typeof parsed.zoom !== "number"
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveMapPosition(center: [number, number], zoom: number): void {
  localStorage.setItem(MAP_POSITION_KEY, JSON.stringify({ center, zoom }))
}

// --- Debounced map position saver ---

export function createDebouncedPositionSaver(delayMs = 500) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (center: [number, number], zoom: number) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => saveMapPosition(center, zoom), delayMs)
  }
}

// --- Serialization helpers ---

function serializeSorted(set: ReadonlySet<string> | readonly string[]): string {
  const arr = Array.isArray(set) ? set : Array.from(set)
  return JSON.stringify(arr.slice().sort())
}

// --- Hook ---

interface PersistenceDefaults {
  readonly allBrandKeys: readonly string[]
}

export function useExplorerPersistence(defaults: PersistenceDefaults) {
  const saved = loadFilters(defaults.allBrandKeys)

  const [metric, setMetric] = useState<Metric>(saved?.metric ?? "total")
  const [display, setDisplay] = useState<Display>(saved?.display ?? "choropleth")
  const [activeLayers, setActiveLayers] = useState<ReadonlySet<LayerId>>(
    () => new Set(saved?.activeLayers ?? [])
  )
  const [trafficOptions, setTrafficOptions] = useState<TrafficLayerOptions>(
    saved?.trafficOptions ?? {}
  )
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(
    () => new Set(saved?.selectedBrands ?? defaults.allBrandKeys)
  )
  const [perspectiveBrand, setPerspectiveBrand] = useState<string | null>(
    saved?.perspectiveBrand ?? null
  )

  const savedMapPosition = loadMapPosition()

  // Persist filters on change (skip if serialized form is unchanged)
  const lastSavedRef = useRef("")

  useEffect(() => {
    const data: PersistedFilters = {
      metric,
      display,
      activeLayers: Array.from(activeLayers),
      trafficOptions,
      selectedBrands: Array.from(selectedBrands),
      perspectiveBrand,
    }
    const serialized = JSON.stringify(data)
    if (serialized === lastSavedRef.current) return
    lastSavedRef.current = serialized
    saveFilters(data)
  }, [metric, display, activeLayers, trafficOptions, selectedBrands, perspectiveBrand])

  return {
    metric,
    setMetric,
    display,
    setDisplay,
    activeLayers,
    setActiveLayers,
    trafficOptions,
    setTrafficOptions,
    selectedBrands,
    setSelectedBrands,
    perspectiveBrand,
    setPerspectiveBrand,
    savedMapPosition,
  }
}

export function clearSavedMapPosition(): void {
  localStorage.removeItem(MAP_POSITION_KEY)
}
