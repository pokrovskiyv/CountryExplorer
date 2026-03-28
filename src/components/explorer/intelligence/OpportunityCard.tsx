import type { Opportunity } from "@/lib/multi-anchor-types"
import { fmt } from "@/lib/opportunity-scoring"
import { fmtJunctionAadf } from "@/lib/junction-scoring"
import { AI_STATION_ANALYSIS } from "@/data/ai-opportunity-analysis"
import { Sparkles } from "lucide-react"

interface OpportunityCardProps {
  readonly opportunity: Opportunity
  readonly highlighted?: boolean
  readonly onClick: () => void
  readonly onFlyTo?: () => void
  readonly onMouseEnter: () => void
  readonly onMouseLeave: () => void
  readonly selectedBrand?: string
}

function scoreBorderColor(score: number): string {
  if (score >= 80) return "border-l-emerald-400"
  if (score >= 60) return "border-l-amber-400"
  return "border-l-border"
}

function scoreBadgeStyle(score: number) {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-400"
  if (score >= 60) return "bg-amber-500/15 text-amber-400"
  return "bg-surface-2 text-muted-foreground"
}

const ANCHOR_ICON: Record<string, string> = {
  station: "\u{1F689}",
  junction: "\u{1F697}",
  msoa: "\u{1F4CD}",
}

const OpportunityCard = ({
  opportunity: opp,
  highlighted = false,
  onClick,
  onFlyTo,
  onMouseEnter,
  onMouseLeave,
  selectedBrand,
}: OpportunityCardProps) => {
  return (
    <div
      className={`bg-surface-1 rounded-lg p-3 cursor-pointer transition-all border-l-[3px] ${scoreBorderColor(opp.compositeScore)} ${
        highlighted ? "ring-1 ring-blue-500/40 bg-surface-2" : "hover:bg-surface-2"
      }`}
      onClick={onFlyTo ?? onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center gap-2.5">
        {/* Score badge — diamond for junctions, circle for stations */}
        {opp.anchorType === "junction" ? (
          <div className={`w-9 h-9 rounded-md rotate-45 flex items-center justify-center text-sm font-bold shrink-0 ${scoreBadgeStyle(opp.compositeScore)}`}>
            <span className="-rotate-45">{opp.compositeScore}</span>
          </div>
        ) : opp.anchorType === "msoa" ? (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${scoreBadgeStyle(opp.compositeScore)}`}>
            {opp.compositeScore}
          </div>
        ) : (
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${scoreBadgeStyle(opp.compositeScore)}`}>
            {opp.compositeScore}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground tabular-nums">#{opp.rank}</span>
            <span className="text-[10px]">{ANCHOR_ICON[opp.anchorType]}</span>
            <span className="text-[13px] font-semibold text-foreground truncate">{opp.label}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground">{opp.region}</span>
            <span className={`text-[9px] ${opp.confidence === "high" ? "text-emerald-400" : opp.confidence === "medium" ? "text-amber-400" : "text-muted-foreground"}`}>
              {opp.signalCount} signals
            </span>
          </div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onClick() }}
          className="text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded p-1 transition-colors shrink-0"
          title="Open details"
          aria-label="Open details"
        >
          &rsaquo;
        </button>
      </div>

      {/* Anchor-specific metrics */}
      <div className="flex gap-2 mt-2 flex-wrap">
        {opp.anchorType === "station" && (
          <>
            <MetricPill color="emerald">{fmt(opp.station.annualEntries)} pax/yr</MetricPill>
            {opp.brandGaps.length > 0 && (
              <MetricPill color="amber">{opp.brandGaps.length} {opp.brandGaps.length === 1 ? "gap" : "gaps"}</MetricPill>
            )}
            <MetricPill color="muted">{opp.station.busStopCount800m ?? 0} bus stops</MetricPill>
          </>
        )}
        {opp.anchorType === "junction" && (
          <>
            <MetricPill color="indigo">{fmtJunctionAadf(opp.trafficPoint.aadf)} veh/day</MetricPill>
            <MetricPill color={opp.driveThruCount === 0 ? "emerald" : "amber"}>
              {opp.driveThruCount} drive-thru
            </MetricPill>
            <MetricPill color="muted">{opp.trafficPoint.roadName}</MetricPill>
          </>
        )}
        {opp.anchorType === "msoa" && (
          <>
            <MetricPill color="cyan">{Math.round(opp.analysis.workplacePop / 1000)}K workers</MetricPill>
            {opp.brandGaps.length > 0 && (
              <MetricPill color="amber">{opp.brandGaps.length} {opp.brandGaps.length === 1 ? "gap" : "gaps"}</MetricPill>
            )}
            <MetricPill color="muted">{opp.qsrCount} QSR nearby</MetricPill>
          </>
        )}
      </div>

      {/* AI insight for stations only */}
      {opp.anchorType === "station" && (() => {
        const aiAnalysis = AI_STATION_ANALYSIS[opp.label]
        if (!aiAnalysis) return null
        return (
          <div className="mt-2 text-[10px] text-purple-300/80 leading-relaxed flex items-start gap-1">
            <Sparkles size={10} className="text-purple-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              {(selectedBrand && aiAnalysis.brandRecommendations[selectedBrand]) || aiAnalysis.recommendation}
            </span>
          </div>
        )
      })()}

      {/* Junction demand hint */}
      {opp.anchorType === "junction" && opp.driveThruCount === 0 && (
        <div className="mt-2 text-[10px] text-indigo-300/80 leading-relaxed">
          Zero drive-thru within 1.5km — first-mover corridor opportunity
        </div>
      )}
    </div>
  )
}

function MetricPill({ color, children }: { color: string; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    indigo: "bg-indigo-500/10 text-indigo-400",
    cyan: "bg-cyan-500/10 text-cyan-400",
    muted: "bg-surface-0/50 text-muted-foreground",
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${styles[color] ?? styles.muted}`}>
      {children}
    </span>
  )
}

export default OpportunityCard
