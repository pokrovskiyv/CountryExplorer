import { TrendingUp, AlertTriangle, Sparkles, Target } from "lucide-react"
import type { StationOpportunity } from "@/lib/opportunity-scoring"
import { fmt } from "@/lib/opportunity-scoring"
import { CompetitiveGrid, CONFIDENCE_CONFIG, ACTION_TIER_CONFIG } from "../opportunities/StationCard"
import { SignalStrengthBar } from "./SignalStrengthBar"
import { CitedFactList, DataCompleteness } from "../opportunities/StationAnalysisPanel"
import { AI_STATION_ANALYSIS } from "@/data/ai-opportunity-analysis"

interface StationDeepDiveProps {
  readonly opportunity: StationOpportunity
}

function scoreBadgeStyle(score: number) {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-400"
  if (score >= 60) return "bg-amber-500/15 text-amber-400"
  return "bg-surface-2 text-muted-foreground"
}

const StationDeepDive = ({ opportunity: opp }: StationDeepDiveProps) => {
  const { analysis } = opp
  const aiAnalysis = AI_STATION_ANALYSIS[opp.station.name]
  const conf = CONFIDENCE_CONFIG[opp.confidence]
  const ConfIcon = conf.Icon
  const tierConfig = aiAnalysis ? ACTION_TIER_CONFIG[aiAnalysis.actionTier] : null
  const bestSignals = opp.brandGaps[0]?.signals ?? []

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Station header */}
      <div className="px-4 py-4 border-b border-border bg-gradient-to-br from-emerald-500/[0.03] to-blue-500/[0.03]">
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${scoreBadgeStyle(opp.compositeScore)}`}>
            {opp.compositeScore}
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{opp.station.name}</h2>
            <div className="text-xs text-muted-foreground mt-0.5">{opp.station.region}</div>
            <div className="flex items-center gap-2 mt-1">
              {tierConfig && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium border ${tierConfig.className} border-current/20`}>
                  {tierConfig.label}
                </span>
              )}
              <span className={`flex items-center gap-0.5 text-[10px] ${conf.className}`}>
                <ConfIcon size={12} />
                {conf.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics grid (2x2) */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <MetricBox label="Annual Footfall" value={fmt(opp.station.annualEntries)} sub={`Top ${Math.max(1, 100 - (analysis?.footfallPercentile ?? 50))}% nationally`} />
        <MetricBox label="Bus Stops" value={String(opp.station.busStopCount800m ?? 0)} sub="Within 800m" />
        <MetricBox label="Nearby QSR" value={String(opp.station.qsrCount800m)} sub={opp.station.qsrCount800m <= 4 ? "Below avg density" : "Average density"} />
        {opp.nearestRoad ? (
          <MetricBox label="Road Traffic" value={fmt(opp.nearestRoad.aadf)} sub={`vehicles/day (${opp.nearestRoad.name})`} />
        ) : (
          <MetricBox label="Road Traffic" value="N/A" sub="No nearby road data" />
        )}
      </div>

      {/* Signal strength */}
      <div className="px-4 py-3 border-t border-border">
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">
          Signal Strength ({opp.signalCount} signals)
        </div>
        <div className="space-y-2">
          {bestSignals.map((signal) => (
            <SignalStrengthBar
              key={signal.name}
              signalKey={signal.name}
              value={signal.fired ? Math.round(signal.strength * 100) : 0}
              fired={signal.fired}
              detail={signal.fired ? signal.rawValue : null}
            />
          ))}
        </div>
      </div>

      {/* Brands within 800m */}
      <div className="px-4 py-3 border-t border-border">
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">
          Brands within 800m
        </div>
        <CompetitiveGrid presentBrands={opp.presentBrands} brandGaps={opp.brandGaps} />
      </div>

      {/* AI Recommendation */}
      {aiAnalysis && (
        <div className="px-4 py-3">
          <div className="bg-purple-500/5 border border-purple-500/15 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={12} className="text-purple-400" />
              <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide">AI Recommendation</span>
            </div>
            <div className="flex items-start gap-2 mb-2">
              <Target size={12} className="text-purple-400 mt-0.5 shrink-0" />
              <p className="text-xs text-foreground/80 leading-relaxed">{aiAnalysis.whyThisStation}</p>
            </div>
            {aiAnalysis.riskMitigation && (
              <div className="flex items-start gap-2">
                <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-foreground/70 leading-relaxed">{aiAnalysis.riskMitigation}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Demand Evidence */}
      {analysis && analysis.demandEvidence.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <h4 className="text-[9px] uppercase tracking-widest text-emerald-400 font-semibold mb-2 flex items-center gap-1">
            <TrendingUp size={11} />
            Demand Evidence
          </h4>
          <CitedFactList facts={analysis.demandEvidence} icon={TrendingUp} iconColor="text-emerald-400" />
        </div>
      )}

      {/* Risks & Caveats */}
      {analysis && analysis.riskFactors.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <h4 className="text-[9px] uppercase tracking-widest text-amber-400 font-semibold mb-2 flex items-center gap-1">
            <AlertTriangle size={11} />
            Risks & Caveats
          </h4>
          <CitedFactList facts={analysis.riskFactors} icon={AlertTriangle} iconColor="text-amber-400" />
        </div>
      )}

      {/* Data completeness */}
      {analysis && (
        <div className="px-4 py-3 border-t border-border">
          <DataCompleteness completeness={analysis.dataCompleteness} missingNotes={analysis.missingDataNotes} />
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

export default StationDeepDive
