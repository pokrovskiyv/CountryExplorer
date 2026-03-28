import type { PointAttributes } from "@/data/brand-attributes"
import { useLocationContext } from "@/hooks/useLocationContext"

// --- Context target types ---

export type ContextTarget =
  | {
      type: "msoa"
      lat: number
      lon: number
      name: string
      score: number
      decile: number
      source: string
    }
  | {
      type: "restaurant"
      lat: number
      lon: number
      brand: string
      address: string
      city: string
      postcode: string
      attrs?: PointAttributes
    }

interface ContextPanelProps {
  target: ContextTarget | null
  onClose: () => void
  selectedBrands: ReadonlySet<string>
}

function deprivationLabel(decile: number): string {
  if (decile <= 2) return "Low deprivation (affluent)"
  if (decile <= 4) return "Below average deprivation"
  if (decile <= 6) return "Average deprivation"
  if (decile <= 8) return "Above average deprivation"
  return "High deprivation"
}

function insightColor(insight: string): string {
  if (insight.includes("missing") || insight.includes("underserved") || insight.includes("No fast food")) {
    return "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
  }
  if (insight.includes("Dense competition") || insight.includes("high deprivation")) {
    return "bg-amber-500/10 border-amber-500/20 text-amber-300"
  }
  return "bg-blue-500/10 border-blue-500/20 text-blue-300"
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100))
  const color = pct >= 60 ? "bg-emerald-500" : pct >= 35 ? "bg-amber-500" : "bg-slate-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-surface-1 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{Math.round(score)}/100</span>
    </div>
  )
}

const ContextPanel = ({ target, onClose, selectedBrands }: ContextPanelProps) => {
  const deprivationDecile = target?.type === "msoa" ? target.decile : null

  const context = useLocationContext(
    target?.lat ?? null,
    target?.lon ?? null,
    selectedBrands,
    deprivationDecile,
  )

  if (!target) {
    return (
      <div className="w-[380px] bg-surface-0 border-l border-border shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="text-base font-semibold">Location details</h2>
        </div>
        <div className="p-4">
          <p className="text-muted-foreground text-[13px]">
            Click on a restaurant or deprivation area on the map to see local context.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[380px] bg-surface-0 border-l border-border shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {target.type === "msoa" ? (
              <>
                <h2 className="text-base font-semibold text-foreground truncate">{target.name}</h2>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {deprivationLabel(target.decile)} &middot; Decile {target.decile}/10
                </div>
                <div className="text-[11px] text-muted-foreground/60 mt-0.5">{target.source}</div>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-foreground">{target.brand}</h2>
                <div className="text-xs text-muted-foreground mt-0.5">{target.address}</div>
                <div className="text-xs text-muted-foreground">{target.city} {target.postcode}</div>
                {target.attrs && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {target.attrs.delivery.deliveroo && <Badge>Deliveroo</Badge>}
                    {target.attrs.delivery.uberEats && <Badge>Uber Eats</Badge>}
                    {target.attrs.delivery.justEat && <Badge>Just Eat</Badge>}
                    {target.attrs.delivery.ownDelivery && <Badge>Own Delivery</Badge>}
                    {target.attrs.driveThru && <Badge>Drive-Thru</Badge>}
                    {target.attrs.clickAndCollect && <Badge>Click & Collect</Badge>}
                  </div>
                )}
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg px-1 shrink-0"
          >
            x
          </button>
        </div>
      </div>

      {context && (
        <div className="p-4 space-y-4">
          {/* Insight */}
          {context.insight && (
            <div className={`rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed ${insightColor(context.insight)}`}>
              {context.insight}
            </div>
          )}

          {/* Brands nearby */}
          <Section title="Brands nearby" subtitle={`${NEARBY_RADIUS_LABEL}`}>
            {context.nearbyBrands.map((b) => (
              <div key={b.brand} className="flex items-center gap-2 py-1">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${b.count > 0 ? "" : "opacity-30"}`}
                  style={{ background: b.color }}
                />
                <span className={`text-xs flex-1 ${b.count > 0 ? "text-foreground" : "text-muted-foreground/50"}`}>
                  {b.brand}
                </span>
                <span className={`text-xs tabular-nums ${b.count > 0 ? "text-foreground font-medium" : "text-muted-foreground/40"}`}>
                  {b.count > 0 ? `x${b.count}` : "\u2014"}
                </span>
              </div>
            ))}
            {context.totalNearby > 0 && (
              <div className="text-[11px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border">
                {context.totalNearby} location{context.totalNearby !== 1 ? "s" : ""} total
              </div>
            )}
          </Section>

          {/* Nearest station */}
          {context.nearestStation && (
            <Section title="Nearest station">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-foreground font-medium">{context.nearestStation.name}</span>
                <span className="text-xs text-muted-foreground">{context.nearestStation.distanceLabel}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {context.nearestStation.footfallLabel} passengers
              </div>
              {context.nearestStation.opportunityScore !== null && (
                <div className="mt-2">
                  <div className="text-[11px] text-muted-foreground mb-1">Opportunity score</div>
                  <ScoreBar score={context.nearestStation.opportunityScore} />
                </div>
              )}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

const NEARBY_RADIUS_LABEL = "1km"

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</h4>
        {subtitle && <span className="text-[11px] text-muted-foreground/60">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-1 text-muted-foreground border border-border">
      {children}
    </span>
  )
}

export { deprivationLabel, insightColor, ScoreBar, Section, Badge }
export default ContextPanel
