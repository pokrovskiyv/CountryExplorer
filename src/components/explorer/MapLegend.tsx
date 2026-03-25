import type { LayerLegendConfig } from "@/hooks/map-layers/types"

interface BaseLegendProps {
  readonly label: string
  readonly display: "choropleth" | "points" | "both" | "heatmap"
  readonly metric: "total" | "density" | "share"
  readonly maxMetric: number
  readonly interpolateColor: (t: number) => string
}

interface OverlayLegendsProps {
  readonly items: readonly { readonly id: string; readonly config: LayerLegendConfig }[]
}

type MapLegendProps = BaseLegendProps & OverlayLegendsProps

function GradientLegendItem({ config }: { config: Extract<LayerLegendConfig, { type: "gradient" }> }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{config.label}</div>
      <div className="flex gap-0.5">
        {config.colors.map((color) => (
          <div key={color} className="flex-1 h-3 rounded-sm" style={{ background: color }} />
        ))}
      </div>
      <div className="flex justify-between mt-0.5 text-[10px] text-muted-foreground">
        <span>{config.min}</span>
        <span>{config.max}</span>
      </div>
    </div>
  )
}

function CategoricalLegendItem({ config }: { config: Extract<LayerLegendConfig, { type: "categorical" }> }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{config.label}</div>
      <div className="space-y-0.5">
        {config.items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const MapLegend = ({ label, display, metric, maxMetric, interpolateColor, items }: MapLegendProps) => {
  return (
    <div className="absolute bottom-6 left-6 bg-surface-0/95 border border-border rounded-lg px-4 py-3 z-[500] text-xs max-h-[50vh] overflow-y-auto">
      {/* Base legend (choropleth/heatmap) */}
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">{label}</div>
      {display === "heatmap" ? (
        <>
          <div className="flex gap-0.5">
            {["#1e3a8a", "#3b82f6", "#22d3ee", "#facc15", "#ef4444"].map((color) => (
              <div key={color} className="w-8 h-3.5 rounded-sm" style={{ background: color }} />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            <span>Low</span>
            <span>High</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-0.5">
            {[0, 0.2, 0.4, 0.6, 0.8].map((t) => (
              <div key={t} className="w-8 h-3.5 rounded-sm" style={{ background: interpolateColor(t) }} />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            <span>0</span>
            <span>{maxMetric.toFixed(metric === "total" ? 0 : 1)}</span>
          </div>
        </>
      )}

      {/* Overlay legends */}
      {items.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {items.map(({ id, config }) =>
            config.type === "gradient" ? (
              <GradientLegendItem key={id} config={config} />
            ) : (
              <CategoricalLegendItem key={id} config={config} />
            ),
          )}
        </div>
      )}
    </div>
  )
}

export default MapLegend
