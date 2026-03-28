// Top Locations section for Brand Dossier
// Shows top 10 stations as report cards with score, AI recommendation, signals, risk

import { AlertTriangle, MapPin, Sparkles } from "lucide-react"
import ScoreGauge from "@/components/radar/ScoreGauge"
import { fmt } from "@/lib/opportunity-scoring"
import { getScoreTier } from "@/lib/expansion-scoring"
import { ACTION_TIER_BADGE } from "@/components/explorer/opportunities/ExecutiveBrief"
import { SignalBars } from "@/components/explorer/opportunities/StationCard"
import type { EnrichedTopStation } from "@/hooks/useBrandDossier"

// --- Location Card ---

function LocationCard({
  station,
  brand,
  brandColor,
}: {
  readonly station: EnrichedTopStation
  readonly brand: string
  readonly brandColor: string
}) {
  const tier = getScoreTier(station.score)
  const tierCfg = station.actionTier ? ACTION_TIER_BADGE[station.actionTier] : null

  return (
    <div className="bg-surface-0 border border-border rounded-lg p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <ScoreGauge score={station.score} tier={tier} size={70} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground tabular-nums font-medium">#{station.rank}</span>
            <h3 className="text-lg font-bold text-foreground truncate">{station.stationName}</h3>
            <span className="text-xs text-muted-foreground">{station.region}</span>
            {tierCfg && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ml-auto ${tierCfg.className}`}>
                {tierCfg.label}
              </span>
            )}
          </div>

          {/* Key metrics */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{fmt(station.annualPassengers)} pax/yr <span className="text-muted-foreground/40">[ORR]</span></span>
            <span>{station.busStops} bus stops <span className="text-muted-foreground/40">[NaPTAN]</span></span>
            <span>{station.qsrCount} QSR nearby <span className="text-muted-foreground/40">[Getplace]</span></span>
            {station.nearestRoad && (
              <span>
                <MapPin size={10} className="inline mr-0.5" />
                {station.nearestRoad.name} {fmt(station.nearestRoad.aadf)}/day <span className="text-muted-foreground/40">[DfT]</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AI Brand Recommendation */}
      {station.brandRecommendation && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-md px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles size={12} className="text-purple-400" />
            <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide">
              AI Recommendation for {brand}
            </span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{station.brandRecommendation}</p>
        </div>
      )}

      {/* Why this station */}
      {station.whyThisStation && (
        <p className="text-xs text-foreground/70 leading-relaxed">
          <span className="font-medium text-foreground">Why here: </span>
          {station.whyThisStation}
        </p>
      )}

      {/* Signal bars */}
      <SignalBars signals={station.signals} />

      {/* Risk mitigation */}
      {station.riskMitigation && (
        <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-md px-3 py-2.5">
          <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide mb-0.5">Before Acting</div>
            <p className="text-xs text-foreground/80 leading-relaxed">{station.riskMitigation}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Main Section ---

interface DossierLocationsProps {
  readonly stations: readonly EnrichedTopStation[]
  readonly brand: string
  readonly brandColor: string
}

const DossierLocations = ({ stations, brand, brandColor }: DossierLocationsProps) => {
  if (stations.length === 0) return null

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">
          Top {stations.length} Locations for {brand}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Each location scored across 6 data signals with AI-generated strategic recommendation.
        </p>
      </div>
      <div className="space-y-4">
        {stations.map((station) => (
          <LocationCard
            key={station.stationName}
            station={station}
            brand={brand}
            brandColor={brandColor}
          />
        ))}
      </div>
    </section>
  )
}

export default DossierLocations
