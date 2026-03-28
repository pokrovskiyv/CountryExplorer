// Opportunities View — orchestrator with split-view map integration
// Cards mode: map (left) + scrollable cards (right)
// Table mode: full-width table

import { useCallback, useRef, useState } from "react"
import { LayoutGrid, Table2 } from "lucide-react"
import { useOpportunities } from "@/hooks/useOpportunities"
import ExecutiveBrief from "./opportunities/ExecutiveBrief"
import StationCard from "./opportunities/StationCard"
import OpportunitiesTable from "./opportunities/OpportunitiesTable"
import OpportunityMapView from "./opportunities/OpportunityMapView"

interface OpportunitiesViewProps {
  readonly selectedBrands: ReadonlySet<string>
}

type ViewMode = "cards" | "table"

const OpportunitiesView = ({ selectedBrands }: OpportunitiesViewProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("cards")
  const [highlightedStation, setHighlightedStation] = useState<string | null>(null)
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const { stations, kpis, narrative, brandIntelligence, brandLabel } = useOpportunities(selectedBrands)

  // Single brand name for per-card AI recommendations
  const selectedBrand = selectedBrands.size === 1 ? [...selectedBrands][0] : undefined

  const shownStations = viewMode === "cards" ? stations.slice(0, 30) : stations

  const handleMapStationClick = useCallback((stationName: string) => {
    setHighlightedStation(stationName)
    const el = cardRefsMap.current.get(stationName)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [])

  const handleCardHover = useCallback((stationName: string) => {
    setHighlightedStation(stationName)
  }, [])

  const setCardRef = useCallback((name: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefsMap.current.set(name, el)
    } else {
      cardRefsMap.current.delete(name)
    }
  }, [])

  if (viewMode === "table") {
    return (
      <div className="p-6 max-w-[1100px] mx-auto space-y-5">
        <ExecutiveBrief kpis={kpis} narrative={narrative} brandLabel={brandLabel} brandIntelligence={brandIntelligence} />
        <ViewToggle viewMode={viewMode} onChangeMode={setViewMode} stationCount={stations.length} />
        <OpportunitiesTable stations={shownStations} />
      </div>
    )
  }

  // Split-view: map left + cards right
  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Map panel */}
      <div className="w-[55%] p-3 shrink-0">
        <OpportunityMapView
          stations={shownStations}
          highlightedStation={highlightedStation}
          onStationClick={handleMapStationClick}
        />
      </div>

      {/* Cards panel */}
      <div className="w-[45%] overflow-y-auto p-4 space-y-4">
        <ExecutiveBrief kpis={kpis} narrative={narrative} brandLabel={brandLabel} brandIntelligence={brandIntelligence} />
        <ViewToggle viewMode={viewMode} onChangeMode={setViewMode} stationCount={stations.length} />

        <div className="space-y-2.5">
          {shownStations.map((opp) => (
            <StationCard
              key={opp.station.name}
              ref={(el) => setCardRef(opp.station.name, el)}
              opportunity={opp}
              selectedBrand={selectedBrand}
              highlighted={highlightedStation === opp.station.name}
              onHover={() => handleCardHover(opp.station.name)}
            />
          ))}
          {stations.length > 30 && (
            <div className="text-center py-3">
              <button
                onClick={() => setViewMode("table")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Showing top 30 of {stations.length} — switch to Table view for all
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// View toggle extracted to avoid duplication
function ViewToggle({
  viewMode,
  onChangeMode,
  stationCount,
}: {
  readonly viewMode: ViewMode
  readonly onChangeMode: (mode: ViewMode) => void
  readonly stationCount: number
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted-foreground">
        {stationCount} station{stationCount !== 1 ? "s" : ""} with brand gaps
      </div>
      <div className="flex bg-surface-1 rounded-lg p-0.5 border border-border">
        <button
          onClick={() => onChangeMode("cards")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            viewMode === "cards"
              ? "bg-surface-2 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid size={13} />
          Cards
        </button>
        <button
          onClick={() => onChangeMode("table")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            viewMode === "table"
              ? "bg-surface-2 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Table2 size={13} />
          Table
        </button>
      </div>
    </div>
  )
}

export default OpportunitiesView
