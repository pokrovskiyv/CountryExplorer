// Station Analysis Panel — expanded deep-dive with cited evidence
// Shows demand evidence, supply gaps, risks, per-brand breakdown, data completeness

import { TrendingUp, AlertTriangle, Database, CheckCircle2, XCircle, Sparkles, Target } from "lucide-react"
import type { StationOpportunity, CitedFact, SourceType } from "@/lib/opportunity-scoring"
import { fmt } from "@/lib/opportunity-scoring"
import { useCountry } from "@/contexts/CountryContext"
import { AI_STATION_ANALYSIS } from "@/data/ai-opportunity-analysis"

interface StationAnalysisPanelProps {
  readonly opportunity: StationOpportunity
}

const SOURCE_BADGE_STYLES: Record<SourceType, { label: string; className: string }> = {
  gov: { label: "GOV", className: "bg-blue-500/15 text-blue-400" },
  getplace: { label: "GP", className: "bg-emerald-500/15 text-emerald-400" },
  derived: { label: "CROSS", className: "bg-purple-500/15 text-purple-400" },
}

function SourceBadge({ sourceType }: { readonly sourceType: SourceType }) {
  const style = SOURCE_BADGE_STYLES[sourceType]
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${style.className}`}>
      {style.label}
    </span>
  )
}

function CitedFactList({
  facts,
  icon: Icon,
  iconColor,
}: {
  readonly facts: readonly CitedFact[]
  readonly icon: typeof TrendingUp
  readonly iconColor: string
}) {
  if (facts.length === 0) return null

  return (
    <div className="space-y-1.5">
      {facts.map((fact, i) => (
        <div key={i} className="flex items-start gap-2">
          <Icon size={12} className={`${iconColor} mt-0.5 shrink-0`} />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-foreground">{fact.text}</span>
            <span className="ml-1.5 inline-flex items-center gap-1">
              <SourceBadge sourceType={fact.sourceType} />
              <span className="text-[9px] text-muted-foreground">{fact.source}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function DataCompleteness({
  completeness,
  missingNotes,
}: {
  readonly completeness: number
  readonly missingNotes: readonly string[]
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Database size={12} className="text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Data completeness</span>
      </div>
      <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden max-w-[120px]">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${completeness}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{completeness}%</span>
      {missingNotes.length > 0 && (
        <span className="text-[10px] text-amber-400/70">
          ({missingNotes.join("; ")})
        </span>
      )}
    </div>
  )
}

function BrandGapBreakdown({ opportunity: opp }: { readonly opportunity: StationOpportunity }) {
  const { brands } = useCountry()

  return (
    <div className="space-y-3">
      {opp.brandGaps.map((bg) => {
        const firedSignals = bg.signals.filter((s) => s.fired)
        const formula = firedSignals
          .map((s) => `${s.name}:${(s.weight / 100 * s.strength * 100).toFixed(0)}`)
          .join(" + ")

        return (
          <div key={bg.brand} className="bg-surface-0 border border-border/50 rounded-md p-3">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: brands[bg.brand]?.color ?? "#888" }}
              />
              <span className="text-sm font-medium text-foreground">{bg.brand}</span>
              <span className="text-[10px] text-muted-foreground">({bg.affinity} brand)</span>
              <span className={`ml-auto text-sm font-bold tabular-nums ${
                bg.score >= 80 ? "text-emerald-400" :
                bg.score >= 60 ? "text-amber-400" :
                "text-muted-foreground"
              }`}>
                {bg.score}/100
              </span>
            </div>

            {/* Signal detail table */}
            <table className="w-full text-[11px] mb-2">
              <tbody>
                {bg.signals.map((s) => (
                  <tr key={s.name} className={s.fired ? "text-foreground" : "text-muted-foreground/40"}>
                    <td className="py-0.5 w-5">{s.fired ? <CheckCircle2 size={10} className="text-emerald-400" /> : <XCircle size={10} />}</td>
                    <td className="py-0.5 w-20">{s.name}</td>
                    <td className="py-0.5 text-muted-foreground">{s.source}</td>
                    <td className="py-0.5">{s.rawValue}</td>
                    <td className="py-0.5 text-right tabular-nums w-10">{s.fired ? `${s.weight}×${s.strength.toFixed(1)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bg-surface-1 rounded px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground">
              {formula} × confidence({firedSignals.length} signals) = <span className="text-emerald-400 font-bold">{bg.score}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const StationAnalysisPanel = ({ opportunity: opp }: StationAnalysisPanelProps) => {
  const { analysis } = opp
  const aiAnalysis = AI_STATION_ANALYSIS[opp.station.name]

  return (
    <div className="border-t border-border bg-surface-1/50 p-4 space-y-4">
      {/* AI: Why this station */}
      {aiAnalysis && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={12} className="text-purple-400" />
            <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide">AI Strategic Analysis</span>
          </div>

          {/* Why this station */}
          <div className="flex items-start gap-2">
            <Target size={12} className="text-purple-400 mt-0.5 shrink-0" />
            <p className="text-xs text-foreground leading-relaxed">
              <span className="text-purple-400 font-medium">Why here: </span>
              {aiAnalysis.whyThisStation}
            </p>
          </div>

          {/* Per-brand AI recommendations */}
          {Object.keys(aiAnalysis.brandRecommendations).length > 0 && (
            <div>
              <h5 className="text-[10px] text-purple-400/70 font-semibold uppercase tracking-wide mb-1.5">Brand-Specific Recommendations</h5>
              <div className="space-y-1">
                {Object.entries(aiAnalysis.brandRecommendations).map(([brand, rec]) => (
                  <div key={brand} className="flex items-start gap-2">
                    <span className="text-[10px] text-foreground font-medium w-20 shrink-0">{brand}</span>
                    <span className="text-[10px] text-foreground/70 leading-relaxed">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Risk mitigation */}
          <div className="flex items-start gap-2">
            <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[10px] text-foreground/70 leading-relaxed">
              <span className="text-amber-400 font-medium">Before acting: </span>
              {aiAnalysis.riskMitigation}
            </p>
          </div>
        </div>
      )}

      {/* Percentile context */}
      <div className="flex gap-4 text-xs">
        <span className="text-muted-foreground">
          Footfall: <span className="text-foreground font-medium">top {100 - analysis.footfallPercentile}%</span> nationally
        </span>
        <span className="text-muted-foreground">
          Pedestrian: <span className="text-foreground font-medium">top {100 - analysis.pedestrianPercentile}%</span>
        </span>
        <span className="text-muted-foreground">
          QSR density: <span className="text-foreground font-medium">percentile {analysis.qsrDensityPercentile}</span>
        </span>
      </div>

      {/* Demand evidence */}
      <div>
        <h4 className="text-[10px] uppercase tracking-wide text-emerald-400 font-semibold mb-2 flex items-center gap-1">
          <TrendingUp size={11} />
          Demand Evidence
        </h4>
        <CitedFactList facts={analysis.demandEvidence} icon={TrendingUp} iconColor="text-emerald-400" />
      </div>

      {/* Supply gap */}
      {analysis.supplyGapEvidence.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase tracking-wide text-blue-400 font-semibold mb-2 flex items-center gap-1">
            <Database size={11} />
            Supply Gap
          </h4>
          <CitedFactList facts={analysis.supplyGapEvidence} icon={Database} iconColor="text-blue-400" />
        </div>
      )}

      {/* Risks */}
      {analysis.riskFactors.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase tracking-wide text-amber-400 font-semibold mb-2 flex items-center gap-1">
            <AlertTriangle size={11} />
            Risks & Caveats
          </h4>
          <CitedFactList facts={analysis.riskFactors} icon={AlertTriangle} iconColor="text-amber-400" />
        </div>
      )}

      {/* Data completeness */}
      <DataCompleteness
        completeness={analysis.dataCompleteness}
        missingNotes={analysis.missingDataNotes}
      />

      {/* Per-brand breakdown */}
      <div>
        <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
          Per-Brand Score Breakdown
        </h4>
        <BrandGapBreakdown opportunity={opp} />
      </div>
    </div>
  )
}

export { CitedFactList, SourceBadge, DataCompleteness, SOURCE_BADGE_STYLES }
export default StationAnalysisPanel
