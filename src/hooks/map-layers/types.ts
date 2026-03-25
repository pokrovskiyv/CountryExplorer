import L from "leaflet"

// --- Layer identity ---

export type LayerId =
  | "stationAnalysis"
  | "traffic"
  | "demographicIncome"
  | "demographicImd"

export interface LayerMeta {
  readonly id: LayerId
  readonly label: string
  readonly description?: string
  readonly category: "transport" | "opportunities" | "demographics"
  readonly color: string // indicator dot in UI
}

export const LAYER_CATALOG: readonly LayerMeta[] = [
  { id: "stationAnalysis", label: "Station analysis", description: "Size = footfall, color = opportunity score", category: "opportunities", color: "#22c55e" },
  { id: "traffic", label: "Road traffic flow", description: "Busy roads — white borders mark drive-thru gaps", category: "transport", color: "#3b82f6" },
  { id: "demographicIncome", label: "Income level", description: "Regions by median income decile", category: "demographics", color: "#a855f7" },
  { id: "demographicImd", label: "Deprivation index", description: "Regions by government deprivation score", category: "demographics", color: "#ec4899" },
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
