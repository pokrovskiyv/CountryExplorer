import type { JunctionOpportunity } from "@/lib/multi-anchor-types"
import { fmtJunctionAadf } from "@/lib/junction-scoring"
import { SignalStrengthBar } from "./SignalStrengthBar"
import { junctionSignalDetail } from "@/lib/signal-detail"

interface JunctionDeepDiveProps {
  readonly opportunity: JunctionOpportunity
}

function scoreBadgeStyle(score: number) {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-400"
  if (score >= 60) return "bg-amber-500/15 text-amber-400"
  return "bg-surface-2 text-muted-foreground"
}

const SATURATION_LABELS: Record<string, { label: string; className: string }> = {
  none: { label: "No drive-thru nearby", className: "text-emerald-400" },
  low: { label: "Low saturation (1 nearby)", className: "text-amber-400" },
  saturated: { label: "Saturated (2+ nearby)", className: "text-muted-foreground" },
}

const JunctionDeepDive = ({ opportunity: opp }: JunctionDeepDiveProps) => {
  const { analysis } = opp
  const sat = SATURATION_LABELS[analysis.driveThruSaturation]

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border bg-gradient-to-br from-indigo-500/[0.03] to-rose-500/[0.03]">
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-lg rotate-45 flex items-center justify-center text-xl font-bold shrink-0 ${scoreBadgeStyle(opp.compositeScore)}`}>
            <span className="-rotate-45">{opp.compositeScore}</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{opp.trafficPoint.roadName}</h2>
            <div className="text-xs text-muted-foreground mt-0.5">
              {opp.region} &middot; {opp.trafficPoint.roadType}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium">
                Drive-thru opportunity
              </span>
              <span className={`text-[10px] ${sat.className}`}>{sat.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <MetricBox
          label="Daily Traffic"
          value={`${fmtJunctionAadf(opp.trafficPoint.aadf)}`}
          sub={`vehicles/day (top ${100 - analysis.aadPercentile}%)`}
        />
        <MetricBox
          label="Drive-Thru Nearby"
          value={String(opp.driveThruCount)}
          sub="within 1.5km"
        />
        <MetricBox
          label="QSR Nearby"
          value={String(opp.qsrCount)}
          sub="within 1.5km"
        />
        <MetricBox
          label="Confidence"
          value={opp.confidence}
          sub={`${opp.signalCount} of 4 signals fired`}
        />
      </div>

      {/* Signal bars */}
      <div className="px-4 py-3 border-t border-border">
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">
          Signal Strength
        </div>
        <div className="space-y-2">
          {Object.entries(opp.signalProfile).map(([key, value]) => (
            <SignalStrengthBar
              key={key}
              signalKey={key}
              value={value}
              fired={value > 0}
              detail={junctionSignalDetail(key, opp)}
            />
          ))}
        </div>
      </div>

      {/* Demand Evidence */}
      {analysis.demandEvidence.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <h4 className="text-[9px] uppercase tracking-widest text-emerald-400 font-semibold mb-2">
            Demand Evidence
          </h4>
          <div className="space-y-1.5">
            {analysis.demandEvidence.map((text, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <span className="text-emerald-400 mt-0.5 shrink-0">+</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {analysis.riskFactors.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <h4 className="text-[9px] uppercase tracking-widest text-amber-400 font-semibold mb-2">
            Risks & Caveats
          </h4>
          <div className="space-y-1.5">
            {analysis.riskFactors.map((text, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/70">
                <span className="text-amber-400 mt-0.5 shrink-0">!</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location */}
      <div className="px-4 py-3 border-t border-border text-[10px] text-muted-foreground">
        Coordinates: {opp.lat.toFixed(4)}, {opp.lng.toFixed(4)}
      </div>
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

export default JunctionDeepDive
