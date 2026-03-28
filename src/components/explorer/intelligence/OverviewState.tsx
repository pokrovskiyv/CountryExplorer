import { useState, useMemo } from "react"
import { ChevronDown } from "lucide-react"
import type { OpportunityKpis, NarrativeSentence } from "@/lib/opportunity-scoring"
import type { BrandIntelligence } from "@/hooks/useOpportunities"
import type { Opportunity, AnchorType } from "@/lib/multi-anchor-types"
import OpportunityCard from "./OpportunityCard"

interface OverviewStateProps {
  opportunities: readonly Opportunity[]
  totalCounts: { stations: number; junctions: number; zones: number }
  kpis: OpportunityKpis
  narrative: readonly NarrativeSentence[]
  brandIntelligence: BrandIntelligence | null
  brandLabel: string
  selectedBrands: Set<string>
  anchorFilter: AnchorType | "all"
  onAnchorFilterChange: (filter: AnchorType | "all") => void
  onOpportunitySelect: (id: string) => void
  onOpportunityFlyTo?: (id: string) => void
  highlightedStation: string | null
  onHighlightStation: (name: string | null) => void
}

type TierFilter = "all" | "act-now" | "evaluate" | "monitor"
type SortBy = "score" | "footfall" | "gaps"

const INITIAL_SHOW = 20

function getActionTier(score: number): string {
  if (score >= 80) return "act-now"
  if (score >= 60) return "evaluate"
  return "monitor"
}

const ANCHOR_CHIPS: { value: AnchorType | "all"; label: string; icon: string }[] = [
  { value: "all", label: "All", icon: "" },
  { value: "station", label: "Stations", icon: "\u{1F689}" },
  { value: "junction", label: "Junctions", icon: "\u{1F697}" },
  { value: "msoa", label: "Zones", icon: "\u{1F4CD}" },
]

const OverviewState = ({
  opportunities,
  totalCounts,
  kpis,
  narrative,
  brandIntelligence,
  brandLabel,
  selectedBrands,
  anchorFilter,
  onAnchorFilterChange,
  onOpportunitySelect,
  onOpportunityFlyTo,
  highlightedStation,
  onHighlightStation,
}: OverviewStateProps) => {
  const [showAll, setShowAll] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [tierFilter, setTierFilter] = useState<TierFilter>("all")
  const [sortBy, setSortBy] = useState<SortBy>("score")
  const selectedBrand = selectedBrands.size === 1 ? [...selectedBrands][0] : undefined

  const filteredAndSorted = useMemo(() => {
    let result = [...opportunities]

    if (tierFilter !== "all") {
      result = result.filter((s) => getActionTier(s.compositeScore) === tierFilter)
    }

    if (sortBy === "score") {
      // already sorted by score from the hook
    } else if (sortBy === "footfall") {
      result.sort((a, b) => {
        const aVal = a.anchorType === "station" ? a.station.annualEntries
          : a.anchorType === "junction" ? a.trafficPoint.aadf : 0
        const bVal = b.anchorType === "station" ? b.station.annualEntries
          : b.anchorType === "junction" ? b.trafficPoint.aadf : 0
        return bVal - aVal
      })
    } else if (sortBy === "gaps") {
      result.sort((a, b) => {
        const aGaps = a.anchorType === "station" ? a.brandGaps.length : 0
        const bGaps = b.anchorType === "station" ? b.brandGaps.length : 0
        return bGaps - aGaps
      })
    }

    return result
  }, [opportunities, tierFilter, sortBy])

  const visibleStations = showAll ? filteredAndSorted : filteredAndSorted.slice(0, INITIAL_SHOW)

  const anchorCounts: Record<string, number> = {
    all: totalCounts.stations + totalCounts.junctions + totalCounts.zones,
    station: totalCounts.stations,
    junction: totalCounts.junctions,
    msoa: totalCounts.zones,
  }

  return (
    <>
      {/* Executive Brief — collapsible */}
      <div className="border-b border-border bg-gradient-to-br from-emerald-500/[0.03] to-blue-500/[0.03]">
        <button
          onClick={() => setBriefOpen(!briefOpen)}
          className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-surface-1/30 transition-colors"
        >
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Executive Brief</span>
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${briefOpen ? "rotate-180" : ""}`} />
        </button>
        {briefOpen && (
          <div className="px-4 pb-3">
            <div className="text-xs text-foreground/80 leading-relaxed">
              {narrative.length > 0
                ? narrative.map((s, i) => (
                    <span key={i}>
                      {i > 0 && " "}
                      {s.text}
                    </span>
                  ))
                : `${kpis.stationCount} stations analysed. Top: ${kpis.topStation} (score ${kpis.topScore}).`}
            </div>
            {brandIntelligence && (
              <div className="flex items-center gap-2 mt-2 text-[10px]">
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                  {brandIntelligence.affinity} brand
                </span>
                <span className="text-muted-foreground">
                  Income affinity: deciles {brandIntelligence.idealDecileRange}
                </span>
                <span className="text-muted-foreground">&middot;</span>
                <span className="text-emerald-400">
                  {brandIntelligence.affinityMatchRate}% match
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Anchor type filter */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 flex-wrap">
        {ANCHOR_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => { onAnchorFilterChange(chip.value); setShowAll(false) }}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
              anchorFilter === chip.value
                ? "bg-blue-500/15 text-blue-400"
                : "text-muted-foreground hover:bg-surface-1"
            }`}
          >
            {chip.icon && <span className="mr-0.5">{chip.icon}</span>}
            {chip.label}
            <span className="text-muted-foreground/60 ml-0.5">({anchorCounts[chip.value] ?? 0})</span>
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        {(["all", "act-now", "evaluate", "monitor"] as const).map((tier) => (
          <button
            key={tier}
            onClick={() => { setTierFilter(tier); setShowAll(false) }}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
              tierFilter === tier
                ? tier === "act-now" ? "bg-emerald-500/15 text-emerald-400"
                  : tier === "evaluate" ? "bg-amber-500/15 text-amber-400"
                  : tier === "monitor" ? "bg-surface-2 text-muted-foreground"
                  : "bg-blue-500/15 text-blue-400"
                : "text-muted-foreground hover:bg-surface-1"
            }`}
          >
            {tier === "all" ? "All" : tier === "act-now" ? "Act Now" : tier === "evaluate" ? "Evaluate" : "Monitor"}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="text-[10px] bg-surface-1 border border-border rounded px-1.5 py-0.5 text-foreground"
          >
            <option value="score">Score</option>
            <option value="footfall">Traffic</option>
            <option value="gaps">Gaps</option>
          </select>
        </div>
      </div>

      {selectedBrands.size > 1 && (
        <div className="px-4 py-1.5 text-[10px] text-muted-foreground bg-surface-1/50 border-b border-border">
          Select a single brand for focused recommendations
        </div>
      )}

      {/* Opportunity list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2 px-1">
          Top Opportunities
          <span className="text-muted-foreground/60 ml-1">({filteredAndSorted.length})</span>
        </div>

        <div className="flex flex-col gap-2">
          {visibleStations.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              highlighted={opp.anchorType === "station" && highlightedStation === opp.label}
              onClick={() => onOpportunitySelect(opp.id)}
              onFlyTo={onOpportunityFlyTo ? () => onOpportunityFlyTo(opp.id) : undefined}
              onMouseEnter={() => opp.anchorType === "station" && onHighlightStation(opp.label)}
              onMouseLeave={() => onHighlightStation(null)}
              selectedBrand={selectedBrand}
            />
          ))}
        </div>

        {filteredAndSorted.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            No opportunities match the current filters
          </div>
        )}

        {!showAll && filteredAndSorted.length > INITIAL_SHOW && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full text-center py-3 text-blue-400 text-xs hover:underline"
          >
            Show all {filteredAndSorted.length} opportunities &darr;
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border flex items-center justify-between text-[9px] text-muted-foreground">
        <span>{filteredAndSorted.length} of {opportunities.length} opportunities</span>
        <button className="text-blue-400/40 cursor-not-allowed" disabled title="Coming soon">
          Export CSV
        </button>
      </div>
    </>
  )
}

export default OverviewState
