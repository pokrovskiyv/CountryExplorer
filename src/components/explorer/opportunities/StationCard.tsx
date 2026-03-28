// Station Card — one card per station opportunity
// Shows ScoreGauge, competitive landscape, signal bars, expand to analysis

import { forwardRef, useState } from "react"
import { ChevronDown, MapPin, Shield, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react"
import ScoreGauge from "@/components/radar/ScoreGauge"
import { SignalStrengthBar } from "../intelligence/SignalStrengthBar"
import type { StationOpportunity, ConfidenceLevel, ActionTier } from "@/lib/opportunity-scoring"
import { fmt } from "@/lib/opportunity-scoring"
import type { ScoreTier } from "@/lib/expansion-scoring"
import { useCountry } from "@/contexts/CountryContext"
import { AI_STATION_ANALYSIS } from "@/data/ai-opportunity-analysis"
import StationAnalysisPanel from "./StationAnalysisPanel"

interface StationCardProps {
  readonly opportunity: StationOpportunity
  readonly highlighted?: boolean
  readonly onHover?: () => void
  readonly selectedBrand?: string
}


function scoreTier(score: number): ScoreTier {
  if (score >= 80) return "Hot"
  if (score >= 60) return "Warm"
  if (score >= 40) return "Moderate"
  if (score >= 20) return "Cool"
  return "Cold"
}

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, { label: string; Icon: typeof ShieldCheck; className: string }> = {
  high: { label: "High confidence", Icon: ShieldCheck, className: "text-emerald-400" },
  medium: { label: "Medium confidence", Icon: Shield, className: "text-amber-400" },
  low: { label: "Low confidence", Icon: ShieldAlert, className: "text-muted-foreground" },
}

const ACTION_TIER_CONFIG: Record<ActionTier, { label: string; className: string }> = {
  "act-now": { label: "Act Now", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  evaluate: { label: "Evaluate", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  monitor: { label: "Monitor", className: "bg-surface-2 text-muted-foreground border-border" },
}

function CompetitiveGrid({
  presentBrands,
  brandGaps,
}: {
  readonly presentBrands: StationOpportunity["presentBrands"]
  readonly brandGaps: StationOpportunity["brandGaps"]
}) {
  const { brands } = useCountry()

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {presentBrands.map(({ brand, count }) => (
        <span key={brand} className="flex items-center gap-1 text-xs">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: brands[brand]?.color ?? "#888" }}
          />
          <span className="text-muted-foreground">{brand}</span>
          <span className="text-foreground/50">({count})</span>
        </span>
      ))}
      {brandGaps.map(({ brand }) => (
        <span key={brand} className="flex items-center gap-1 text-xs">
          <span
            className="w-2 h-2 rounded-full border border-red-500/60"
            style={{ backgroundColor: "transparent" }}
          />
          <span className="text-red-400 font-medium">{brand}</span>
          <span className="text-red-400/50">(gap)</span>
        </span>
      ))}
    </div>
  )
}

function SignalBars({ signals }: { readonly signals: StationOpportunity["brandGaps"][number]["signals"] }) {
  return (
    <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
      {signals.map((signal) => (
        <SignalStrengthBar
          key={signal.name}
          signalKey={signal.name}
          value={signal.fired ? Math.round(signal.strength * 100) : 0}
          fired={signal.fired}
          variant="compact"
        />
      ))}
    </div>
  )
}

const StationCard = forwardRef<HTMLDivElement, StationCardProps>(
  ({ opportunity: opp, highlighted = false, onHover, selectedBrand }, ref) => {
  const [expanded, setExpanded] = useState(false)
  const tier = scoreTier(opp.compositeScore)
  const conf = CONFIDENCE_CONFIG[opp.confidence]
  const ConfIcon = conf.Icon
  const aiAnalysis = AI_STATION_ANALYSIS[opp.station.name]

  // Use best brand gap's signals for the card-level signal bars
  const bestSignals = opp.brandGaps[0]?.signals ?? []

  return (
    <div
      ref={ref}
      className={`bg-surface-0 border rounded-lg overflow-hidden transition-all ${
        highlighted ? "border-emerald-500/60 ring-1 ring-emerald-500/20" : "border-border"
      }`}
      onMouseEnter={onHover}
    >
      <div
        className="p-4 cursor-pointer hover:bg-surface-1/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4">
          {/* Score Gauge */}
          <div className="shrink-0">
            <ScoreGauge score={opp.compositeScore} tier={tier} size={80} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground tabular-nums">#{opp.rank}</span>
              <h3 className="text-base font-bold text-foreground truncate">{opp.station.name}</h3>
              <span className="text-xs text-muted-foreground">{opp.station.region}</span>
              {aiAnalysis && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${ACTION_TIER_CONFIG[aiAnalysis.actionTier].className}`}>
                  {ACTION_TIER_CONFIG[aiAnalysis.actionTier].label}
                </span>
              )}
              <span className={`flex items-center gap-0.5 text-[10px] ${conf.className} ml-auto shrink-0`}>
                <ConfIcon size={12} />
                {conf.label}
              </span>
            </div>

            {/* Key metrics */}
            <div className="flex gap-4 text-xs text-muted-foreground mb-2">
              <span>{fmt(opp.station.annualEntries)} pax/yr <span className="text-muted-foreground/40">[ORR]</span></span>
              <span>{opp.station.busStopCount800m ?? 0} bus stops <span className="text-muted-foreground/40">[NaPTAN]</span></span>
              <span>{opp.station.qsrCount800m} QSR nearby <span className="text-muted-foreground/40">[Getplace]</span></span>
              {opp.nearestRoad && (
                <span>
                  <MapPin size={10} className="inline mr-0.5" />
                  {opp.nearestRoad.name} {fmt(opp.nearestRoad.aadf)}/day <span className="text-muted-foreground/40">[DfT]</span>
                </span>
              )}
            </div>

            {/* Competitive grid */}
            <CompetitiveGrid
              presentBrands={opp.presentBrands}
              brandGaps={opp.brandGaps}
            />

            {/* Signal bars */}
            <div className="mt-3">
              <SignalBars signals={bestSignals} />
            </div>

            {/* AI Recommendation */}
            {aiAnalysis && (
              <div className="mt-3 bg-surface-1/60 rounded-md px-3 py-2 border border-border/50">
                <div className="flex items-center gap-1 mb-1">
                  <Sparkles size={10} className="text-purple-400" />
                  <span className="text-[9px] text-purple-400 font-medium uppercase tracking-wide">AI Analysis</span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {(selectedBrand && aiAnalysis.brandRecommendations[selectedBrand]) || aiAnalysis.recommendation}
                </p>
              </div>
            )}
          </div>

          {/* Expand chevron */}
          <ChevronDown
            size={16}
            className={`shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Expanded analysis panel */}
      {expanded && <StationAnalysisPanel opportunity={opp} />}
    </div>
  )
},
)

StationCard.displayName = "StationCard"

export { CompetitiveGrid, SignalBars, CONFIDENCE_CONFIG, ACTION_TIER_CONFIG, scoreTier }
export default StationCard
