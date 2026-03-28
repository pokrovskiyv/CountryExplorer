import L from "leaflet"

// --- Layer identity ---

export type LayerId =
  | "stationAnalysis"
  | "zoneOpportunities"
  | "traffic"
  | "demographicIncome"
  | "demographicImd"
  | "peopleDensity"

export interface LayerMeta {
  readonly id: LayerId
  readonly label: string
  readonly description?: string
  readonly category: "transport" | "opportunities" | "demographics"
  readonly color: string // indicator dot in UI
}

export const LAYER_CATALOG: readonly LayerMeta[] = [
  { id: "stationAnalysis", label: "Station analysis", description: "Size = footfall, color = opportunity score", category: "opportunities", color: "#22c55e" },
  { id: "zoneOpportunities", label: "Zone opportunities", description: "MSOA zones with score 60+ (Evaluate & Act Now)", category: "opportunities", color: "#06b6d4" },
  { id: "traffic", label: "Road traffic flow", description: "Busy roads — white borders mark drive-thru gaps", category: "transport", color: "#3b82f6" },
  { id: "demographicIncome", label: "Income level", description: "Estimated annual salary by MSOA (BRES + ASHE)", category: "demographics", color: "#a855f7" },
  { id: "demographicImd", label: "Deprivation index", description: "MSOA-level choropleth — England & Wales", category: "demographics", color: "#ec4899" },
  { id: "peopleDensity", label: "People density", description: "Foot traffic + workplace population heatmap", category: "demographics", color: "#06b6d4" },
] as const

// --- Layer legend ---

export interface GradientLegend {
  readonly type: "gradient"
  readonly label: string
  readonly colors: readonly string[]
  readonly min: string
  readonly max: string
}

export interface CategoricalLegend {
  readonly type: "categorical"
  readonly label: string
  readonly items: readonly { readonly color: string; readonly label: string }[]
}

export type LayerLegendConfig = GradientLegend | CategoricalLegend

// --- Layer hook contract ---

export interface MapLayerHandle {
  readonly update: (map: L.Map) => void
  readonly remove: (map: L.Map) => void
  readonly legend: LayerLegendConfig | null
}

// --- Layer options ---

export interface TrafficLayerOptions {
  readonly driveThruOnly?: boolean
}

export interface LayerOptionsMap {
  readonly traffic?: TrafficLayerOptions
}
