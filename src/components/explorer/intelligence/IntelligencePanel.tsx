import { Info } from "lucide-react"
import type { PanelState } from "./types"
import type { OpportunityKpis, NarrativeSentence } from "@/lib/opportunity-scoring"
import { fmt } from "@/lib/opportunity-scoring"
import type { BrandIntelligence } from "@/hooks/useOpportunities"
import type { Opportunity, AnchorType, StationOpportunityV2, JunctionOpportunity, MsoaOpportunity  } from "@/lib/multi-anchor-types"
import { STATION_DATA, type StationRecord } from "@/data/station-data"
import RegionPanel from "@/components/explorer/RegionPanel"
import OverviewState from "./OverviewState"
import StationDeepDive from "./StationDeepDive"
import JunctionDeepDive from "./JunctionDeepDive"
import ZoneDeepDive from "./ZoneDeepDive"

interface IntelligencePanelProps {
  panelState: PanelState
  opportunities: readonly Opportunity[]
  stationOpps: readonly StationOpportunityV2[]
  junctionOpps: readonly JunctionOpportunity[]
  totalCounts: { stations: number; junctions: number; zones: number }
  kpis: OpportunityKpis
  narrative: readonly NarrativeSentence[]
  brandIntelligence: BrandIntelligence | null
  brandLabel: string
  selectedBrands: Set<string>
  perspectiveBrand: string | null
  onPerspectiveChange: (brand: string | null) => void
  anchorFilter: AnchorType | "all"
  onAnchorFilterChange: (filter: AnchorType | "all") => void
  onOpportunitySelect: (id: string) => void
  onOpportunityFlyTo?: (id: string) => void
  onBack: () => void
  highlightedStation: string | null
  onHighlightStation: (name: string | null) => void
}

const MODE_LABELS: Record<string, string> = {
  overview: "Overview",
  station: "Station",
  junction: "Junction",
  zone: "Zone",
  region: "Region",
}

const IntelligencePanel = ({
  panelState,
  opportunities,
  stationOpps,
  junctionOpps,
  totalCounts,
  kpis,
  narrative,
  brandIntelligence,
  brandLabel,
  selectedBrands,
  perspectiveBrand,
  onPerspectiveChange,
  anchorFilter,
  onAnchorFilterChange,
  onOpportunitySelect,
  onOpportunityFlyTo,
  onBack,
  highlightedStation,
  onHighlightStation,
}: IntelligencePanelProps) => {
  return (
    <div className="w-[400px] min-w-[360px] max-w-[440px] bg-surface-0 border-l border-border flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        {panelState.mode !== "overview" && (
          <button
            onClick={onBack}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium mr-2"
            aria-label="Back to overview"
          >
            &larr; Back
          </button>
        )}
        <span className="text-sm font-semibold text-foreground">Intelligence</span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-surface-1 rounded">
          {MODE_LABELS[panelState.mode] ?? panelState.mode}
        </span>
      </div>

      {panelState.mode === "overview" && (
        <OverviewState
          opportunities={opportunities}
          totalCounts={totalCounts}
          kpis={kpis}
          narrative={narrative}
          brandIntelligence={brandIntelligence}
          brandLabel={brandLabel}
          perspectiveBrand={perspectiveBrand}
          onPerspectiveChange={onPerspectiveChange}
          anchorFilter={anchorFilter}
          onAnchorFilterChange={onAnchorFilterChange}
          onOpportunitySelect={onOpportunitySelect}
          onOpportunityFlyTo={onOpportunityFlyTo}
          highlightedStation={highlightedStation}
          onHighlightStation={onHighlightStation}
        />
      )}

      {panelState.mode === "station" && (() => {
        const station = stationOpps.find((s) => s.label === panelState.stationName)
        if (!station) {
          const raw = STATION_DATA.find((s) => s.name === panelState.stationName)
          if (!raw) {
            return (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Station not found: {panelState.stationName}
              </div>
            )
          }
          return <StationBasicCard station={raw} />
        }
        // StationDeepDive expects the original StationOpportunity shape
        const legacyOpp = {
          rank: station.rank,
          station: station.station,
          compositeScore: station.compositeScore,
          confidence: station.confidence,
          signalCount: station.signalCount,
          brandGaps: station.brandGaps,
          presentBrands: station.presentBrands,
          nearestRoad: station.nearestRoad,
          signalProfile: station.signalProfile,
          analysis: station.analysis,
        }
        return <StationDeepDive opportunity={legacyOpp} />
      })()}

      {panelState.mode === "junction" && (() => {
        const junction = junctionOpps.find((j) => j.id === panelState.junctionId)
        return junction ? (
          <JunctionDeepDive opportunity={junction} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Junction not found
          </div>
        )
      })()}

      {panelState.mode === "zone" && (
        <ZoneDeepDive
          lat={panelState.lat}
          lng={panelState.lng}
          msoaName={panelState.msoaName}
          deprivationDecile={panelState.decile}
          deprivationSource={panelState.source}
          selectedBrands={selectedBrands}
          msoaOpportunity={opportunities.find((o) => o.anchorType === "msoa" && Math.abs(o.lat - panelState.lat) < 0.001 && Math.abs(o.lng - panelState.lng) < 0.001) as MsoaOpportunity | undefined}
        />
      )}

      {panelState.mode === "region" && (
        <RegionPanel
          region={panelState.regionName}
          onClose={onBack}
          selectedBrands={selectedBrands}
        />
      )}
    </div>
  )
}

const TRACKED_BRANDS = ["McDonalds", "KFC", "Subway", "Dominos", "Nandos", "PapaJohns"] as const

function StationBasicCard({ station }: { station: StationRecord }) {
  const present = TRACKED_BRANDS.filter((b) => (station.brandCounts800m[b] ?? 0) > 0)
  const missing = TRACKED_BRANDS.filter((b) => (station.brandCounts800m[b] ?? 0) === 0)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">{station.name}</h2>
        <div className="text-xs text-muted-foreground mt-0.5">{station.region}</div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="bg-surface-1 rounded-lg p-2.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Annual Footfall</div>
          <div className="text-base font-semibold text-foreground mt-0.5">{fmt(station.annualEntries)}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5">passengers/year</div>
        </div>
        <div className="bg-surface-1 rounded-lg p-2.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Nearby QSR</div>
          <div className="text-base font-semibold text-foreground mt-0.5">{station.qsrCount800m}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5">within 800m</div>
        </div>
        <div className="bg-surface-1 rounded-lg p-2.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Bus Stops</div>
          <div className="text-base font-semibold text-foreground mt-0.5">{station.busStopCount800m}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5">within 800m</div>
        </div>
        <div className="bg-surface-1 rounded-lg p-2.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Workforce</div>
          <div className="text-base font-semibold text-foreground mt-0.5">{fmt(station.workplacePop1500m)}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5">within 1.5 km</div>
        </div>
      </div>

      {/* Brand presence */}
      <div className="px-4 py-3 border-t border-border">
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">
          Brands within 800m
        </div>
        {present.length > 0 && (
          <div className="text-xs text-foreground/80 mb-1">
            <span className="text-emerald-400">&#10003;</span> Present: {present.map((b) => `${b} (${station.brandCounts800m[b]})`).join(", ")}
          </div>
        )}
        {missing.length > 0 && (
          <div className="text-xs text-orange-400">
            &#10007; Missing: {missing.join(", ")}
          </div>
        )}
      </div>

      {/* Below-threshold note */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-2 bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
          <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-foreground/70 leading-relaxed">
            This station has {fmt(station.annualEntries)} passengers/year — below the 1M threshold for full opportunity scoring.
            Basic data is shown above. Stations with higher footfall include detailed scoring, signal analysis, and AI recommendations.
          </p>
        </div>
      </div>
    </div>
  )
}

export default IntelligencePanel
