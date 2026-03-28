import { useLocationContext } from "@/hooks/useLocationContext"
import { deprivationLabel, insightColor, ScoreBar, Section } from "../ContextPanel"
import type { MsoaOpportunity } from "@/lib/multi-anchor-types"
import { TrendingUp, AlertTriangle } from "lucide-react"
import { SignalStrengthBar } from "./SignalStrengthBar"
import { zoneSignalDetail } from "@/lib/signal-detail"

interface ZoneDeepDiveProps {
  readonly lat: number
  readonly lng: number
  readonly msoaName: string
  readonly deprivationDecile?: number
  readonly deprivationSource?: string
  readonly selectedBrands: ReadonlySet<string>
  readonly msoaOpportunity?: MsoaOpportunity
}

function scoreBadgeStyle(score: number) {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-400"
  if (score >= 60) return "bg-amber-500/15 text-amber-400"
  return "bg-surface-2 text-muted-foreground"
}

const ZoneDeepDive = ({
  lat,
  lng,
  msoaName,
  deprivationDecile,
  deprivationSource,
  selectedBrands,
  msoaOpportunity: opp,
}: ZoneDeepDiveProps) => {
  const context = useLocationContext(lat, lng, selectedBrands, deprivationDecile ?? null)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Zone header */}
      <div className="px-4 py-4 border-b border-border bg-gradient-to-br from-cyan-500/[0.03] to-purple-500/[0.03]">
        <div className="flex items-center gap-3">
          {opp && (
            <div className={`w-14 h-14 rounded-lg flex items-center justify-center text-xl font-bold shrink-0 ${scoreBadgeStyle(opp.compositeScore)}`}>
              {opp.compositeScore}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-foreground">{msoaName}</h2>
            {deprivationDecile != null && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {deprivationLabel(deprivationDecile)} &middot; Decile {deprivationDecile}/10
              </div>
            )}
            {opp && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-medium">
                  Area opportunity
                </span>
                <span className={`text-[10px] ${opp.confidence === "high" ? "text-emerald-400" : opp.confidence === "medium" ? "text-amber-400" : "text-muted-foreground"}`}>
                  {opp.signalCount} signals &middot; {opp.confidence} conf.
                </span>
              </div>
            )}
            {!opp && deprivationSource && (
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">{deprivationSource}</div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics grid — when opportunity data available */}
      {opp && (
        <div className="grid grid-cols-2 gap-2 p-3">
          <MetricBox
            label="Workplace Pop"
            value={`${Math.round(opp.analysis.workplacePop / 1000)}K`}
            sub="workers (Census 2021)"
          />
          <MetricBox
            label="QSR Nearby"
            value={String(opp.qsrCount)}
            sub={`within 1.5km${opp.qsrCount === 0 ? " — zero!" : ""}`}
          />
          <MetricBox
            label="Brand Gaps"
            value={String(opp.brandGaps.length)}
            sub={`of ${selectedBrands.size} selected`}
          />
          {opp.analysis.nearestStation ? (
            <MetricBox
              label="Nearest Station"
              value={`${opp.analysis.nearestStation.distance.toFixed(1)}km`}
              sub={opp.analysis.nearestStation.name}
            />
          ) : (
            <MetricBox label="Nearest Station" value="N/A" sub="None within 2km" />
          )}
        </div>
      )}

      {/* Signal bars — when opportunity data available */}
      {opp && (
        <div className="px-4 py-3 border-t border-border">
          <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">
            Signal Strength ({opp.signalCount} signals)
          </div>
          <div className="space-y-2">
            {Object.entries(opp.signalProfile).map(([key, value]) => (
              <SignalStrengthBar
                key={key}
                signalKey={key}
                value={value}
                fired={value > 0}
                detail={zoneSignalDetail(key, opp, selectedBrands.size)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Brand gaps — from opportunity or from context */}
      {opp && opp.brandGaps.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">
            Missing Brands ({opp.brandGaps.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {opp.brandGaps.map((brand) => (
              <span key={brand} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {brand}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Demand Evidence */}
      {opp && opp.analysis.demandEvidence.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <h4 className="text-[9px] uppercase tracking-widest text-emerald-400 font-semibold mb-2 flex items-center gap-1">
            <TrendingUp size={11} />
            Demand Evidence
          </h4>
          <div className="space-y-1.5">
            {opp.analysis.demandEvidence.map((text, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <span className="text-emerald-400 mt-0.5 shrink-0">+</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {opp && opp.analysis.riskFactors.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <h4 className="text-[9px] uppercase tracking-widest text-amber-400 font-semibold mb-2 flex items-center gap-1">
            <AlertTriangle size={11} />
            Risks & Caveats
          </h4>
          <div className="space-y-1.5">
            {opp.analysis.riskFactors.map((text, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/70">
                <span className="text-amber-400 mt-0.5 shrink-0">!</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context data (brands nearby, nearest station) — always shown */}
      {context && (
        <div className="p-4 space-y-4 border-t border-border">
          {/* Insight — only if no opportunity data (avoids duplication) */}
          {!opp && context.insight && (
            <div className={`rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed ${insightColor(context.insight)}`}>
              {context.insight}
            </div>
          )}

          {/* Brands nearby */}
          <Section title="Brands nearby" subtitle="1km">
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

          {/* Nearest station — only if no opportunity data (avoids duplication) */}
          {!opp && context.nearestStation && (
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

function MetricBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-surface-1 rounded-lg p-2.5">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-base font-semibold text-foreground mt-0.5">{value}</div>
      <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  )
}

export default ZoneDeepDive
