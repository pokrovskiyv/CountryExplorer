export type PanelState =
  | { mode: "overview" }
  | { mode: "station"; stationName: string }
  | { mode: "junction"; junctionId: string }
  | { mode: "zone"; lat: number; lng: number; msoaName: string; decile?: number; source?: string }
  | { mode: "region"; regionName: string }
