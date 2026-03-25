import { LAYER_CATALOG, type LayerId, type TrafficLayerOptions } from "@/hooks/map-layers/types"

interface LayerPanelProps {
  readonly activeLayers: ReadonlySet<LayerId>
  readonly onToggleLayer: (id: LayerId) => void
  readonly trafficOptions?: TrafficLayerOptions
  readonly onTrafficOptionsChange?: (opts: TrafficLayerOptions) => void
}

const CATEGORIES = [
  { key: "opportunities", label: "Stations & Opportunities" },
  { key: "transport", label: "Road Traffic" },
  { key: "demographics", label: "Demographics" },
] as const

const LayerPanel = ({ activeLayers, onToggleLayer, trafficOptions, onTrafficOptionsChange }: LayerPanelProps) => {
  return (
    <div className="p-4 border-b border-border">
      <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Data Layers</h3>
      <div className="space-y-3">
        {CATEGORIES.map((cat) => {
          const layers = LAYER_CATALOG.filter((l) => l.category === cat.key)
          if (layers.length === 0) return null
          return (
            <div key={cat.key}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-1.5">
                {cat.label}
              </div>
              <div className="space-y-1">
                {layers.map((layer) => {
                  const isActive = activeLayers.has(layer.id)
                  return (
                    <div key={layer.id}>
                      <button
                        onClick={() => onToggleLayer(layer.id)}
                        className={`px-2.5 py-1.5 rounded-md text-xs transition-colors border flex items-center gap-1.5 ${
                          isActive
                            ? "bg-opacity-10 border-current"
                            : "bg-surface-1 border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        }`}
                        style={isActive ? { color: layer.color, backgroundColor: `${layer.color}15`, borderColor: layer.color } : undefined}
                      >
                        <span
                          className="w-2 h-2 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: layer.color, opacity: isActive ? 1 : 0.4 }}
                        />
                        {layer.label}
                      </button>
                      {layer.description && (
                        <p className="text-[10px] text-muted-foreground/60 ml-4 mt-0.5 leading-tight">{layer.description}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Drive-thru corridor sub-filter for traffic */}
              {cat.key === "transport" && activeLayers.has("traffic") && onTrafficOptionsChange && (
                <label className="flex items-center gap-2 mt-1.5 ml-4 text-[11px] text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trafficOptions?.driveThruOnly ?? false}
                    onChange={(e) =>
                      onTrafficOptionsChange({ ...trafficOptions, driveThruOnly: e.target.checked })
                    }
                    className="rounded border-border"
                  />
                  High-traffic roads only (50k+ vehicles/day)
                </label>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default LayerPanel
