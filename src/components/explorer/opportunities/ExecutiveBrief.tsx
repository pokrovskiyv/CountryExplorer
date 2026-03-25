// Executive Brief — narrative summary + KPI tiles + source ribbon
// When exactly 1 brand selected: transforms into Brand Intelligence Brief
// Multi-brand mode: generic station-centric brief (unchanged)

import { ChevronDown, Sparkles, Target, TrendingUp, Users } from "lucide-react"
import type { OpportunityKpis, NarrativeSentence, ActionTier } from "@/lib/opportunity-scoring"
import { AI_EXECUTIVE_SUMMARY } from "@/data/ai-opportunity-analysis"
import { useCountry } from "@/contexts/CountryContext"
import type { BrandIntelligence } from "@/hooks/useOpportunities"

interface ExecutiveBriefProps {
  readonly kpis: OpportunityKpis
  readonly narrative: readonly NarrativeSentence[]
  readonly brandLabel: string
  readonly brandIntelligence: BrandIntelligence | null
}

export const SOURCE_RIBBON = [
  { name: "ORR 2024-25", records: "2,587 stations" },
  { name: "NaPTAN", records: "371K stops" },
  { name: "DfT AADF", records: "5,000 roads" },
  { name: "UK Deprivation Indices", records: "43.5K areas" },
  { name: "Census 2021", records: "7,264 MSOAs" },
  { name: "Getplace", records: "21,263 locations" },
] as const

export const AFFINITY_LABELS: Record<string, string> = {
  premium: "Premium Brand",
  value: "Value Brand",
  neutral: "Mass-Market Brand",
}

export const ACTION_TIER_BADGE: Record<ActionTier, { label: string; className: string }> = {
  "act-now": { label: "Act Now", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  evaluate: { label: "Evaluate", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  monitor: { label: "Monitor", className: "bg-surface-2 text-muted-foreground border-border" },
}

// --- Shared sub-components ---

function KpiTiles({ kpis }: { readonly kpis: OpportunityKpis }) {
  const tiles = [
    { label: "Station Opportunities", value: String(kpis.stationCount) },
    { label: "Avg Score (top 20)", value: `${kpis.avgScore}/100` },
    { label: "Regions Covered", value: String(kpis.regionCount) },
    { label: "Top Station", value: kpis.topStation, sub: `Score ${kpis.topScore}` },
  ] as const

  return (
    <div className="grid grid-cols-4 gap-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="bg-surface-1 border border-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {tile.label}
          </div>
          <div className="text-xl font-bold text-foreground mt-0.5 truncate">
            {tile.value}
          </div>
          {"sub" in tile && tile.sub && (
            <div className="text-[10px] text-muted-foreground mt-0.5">{tile.sub}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function NarrativeBlock({ sentences }: { readonly sentences: readonly NarrativeSentence[] }) {
  if (sentences.length === 0) return null

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4 space-y-2">
      {sentences.map((sentence, i) => (
        <p key={i} className="text-sm text-foreground leading-relaxed">
          {sentence.text}
          <span className="text-[10px] text-muted-foreground ml-1.5">
            [{sentence.sources.join(" + ")}]
          </span>
        </p>
      ))}
    </div>
  )
}

export function SourceRibbon() {
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
      <span className="font-medium">Data sources:</span>
      {SOURCE_RIBBON.map((src, i) => (
        <span key={src.name}>
          <span className="text-foreground/70">{src.name}</span>
          <span className="text-muted-foreground/60"> ({src.records})</span>
          {i < SOURCE_RIBBON.length - 1 && <span className="text-muted-foreground/30"> · </span>}
        </span>
      ))}
    </div>
  )
}

export function MethodologySection() {
  return (
    <details className="border border-border rounded-lg overflow-hidden">
      <summary className="px-4 py-2.5 bg-surface-1 cursor-pointer text-xs font-medium text-foreground hover:bg-surface-2 transition-colors flex items-center gap-2">
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        How we score — 6 signals, weighted formula, data sources
      </summary>
      <div className="p-4 space-y-4 text-xs">
        <div>
          <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">6 Weighted Signals</h4>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1 pr-2 text-muted-foreground font-medium">Signal</th>
                <th className="text-left py-1 pr-2 text-muted-foreground font-medium">Source</th>
                <th className="text-left py-1 pr-2 text-muted-foreground font-medium">Weight</th>
                <th className="text-left py-1 text-muted-foreground font-medium">Fires when</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              <tr className="border-b border-border/50"><td className="py-1.5 pr-2">Footfall</td><td className="pr-2 text-muted-foreground">ORR</td><td className="pr-2">25%</td><td>Station &gt;1M passengers/yr</td></tr>
              <tr className="border-b border-border/50"><td className="py-1.5 pr-2">Brand gap</td><td className="pr-2 text-muted-foreground">Getplace</td><td className="pr-2">25%</td><td>Brand absent, competitors present</td></tr>
              <tr className="border-b border-border/50"><td className="py-1.5 pr-2">Demo fit</td><td className="pr-2 text-muted-foreground">UK Deprivation Indices</td><td className="pr-2">15%</td><td>Income decile matches brand</td></tr>
              <tr className="border-b border-border/50"><td className="py-1.5 pr-2">Low density</td><td className="pr-2 text-muted-foreground">Getplace</td><td className="pr-2">15%</td><td>QSR count &lt;75% of avg</td></tr>
              <tr className="border-b border-border/50"><td className="py-1.5 pr-2">Pedestrian</td><td className="pr-2 text-muted-foreground">NaPTAN</td><td className="pr-2">8%</td><td>30+ bus stops within 800m</td></tr>
              <tr className="border-b border-border/50"><td className="py-1.5 pr-2">Road traffic</td><td className="pr-2 text-muted-foreground">DfT AADF</td><td className="pr-2">7%</td><td>50K+ vehicles/day, &lt;2 drive-thru</td></tr>
              <tr><td className="py-1.5 pr-2">Workforce</td><td className="pr-2 text-muted-foreground">Census 2021</td><td className="pr-2">5%</td><td>20K+ workers within 1.5km</td></tr>
            </tbody>
          </table>
        </div>

        <div className="bg-surface-1 border border-border rounded-md p-3 font-mono text-xs">
          <p className="text-foreground">Score = sum(weight × strength) / totalWeight × 100 × confidenceMultiplier</p>
          <p className="text-muted-foreground mt-1">Confidence: +5% per signal beyond the minimum 2. More evidence = higher score.</p>
        </div>
      </div>
    </details>
  )
}

// --- Brand Intelligence Brief (single-brand mode) ---

function BrandKpiTiles({ bi }: { readonly bi: BrandIntelligence }) {
  const tiles = [
    { label: "Whitespace Locations", value: String(bi.stationCount) },
    { label: "Avg Brand Score", value: `${bi.avgBrandScore}/100` },
    { label: "Income Match", value: `${bi.affinityMatchRate}%`, sub: `Deciles ${bi.idealDecileRange}` },
    {
      label: "Top Location",
      value: bi.topStations[0]?.stationName ?? "—",
      sub: bi.topStations[0] ? `Score ${bi.topStations[0].score}` : undefined,
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="bg-surface-1 border border-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {tile.label}
          </div>
          <div className="text-xl font-bold text-foreground mt-0.5 truncate">
            {tile.value}
          </div>
          {tile.sub && (
            <div className="text-[10px] text-muted-foreground mt-0.5">{tile.sub}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function TopStationsOnePager({ bi }: { readonly bi: BrandIntelligence }) {
  if (bi.topStations.length === 0) return null

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-surface-1 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Target size={13} className="text-emerald-400" />
          <span className="text-xs font-semibold text-foreground">
            Top {bi.topStations.length} for {bi.brand}
          </span>
          <span className="text-[10px] text-muted-foreground ml-1">
            — AI recommendation per station
          </span>
        </div>
      </div>
      <div className="divide-y divide-border/50">
        {bi.topStations.map((station, i) => {
          const tierCfg = station.actionTier ? ACTION_TIER_BADGE[station.actionTier] : null

          return (
            <div key={station.stationName} className="px-4 py-3 hover:bg-surface-1/30 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground tabular-nums font-medium">#{i + 1}</span>
                <span className="text-sm font-semibold text-foreground">{station.stationName}</span>
                <span className="text-xs text-muted-foreground">{station.region}</span>
                <span className="text-xs font-bold text-foreground ml-auto tabular-nums">{station.score}/100</span>
                {tierCfg && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${tierCfg.className}`}>
                    {tierCfg.label}
                  </span>
                )}
              </div>
              {station.recommendation && (
                <div className="flex items-start gap-1.5 mt-1">
                  <Sparkles size={10} className="text-purple-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground/80 leading-relaxed">{station.recommendation}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BrandIntelligenceBrief({
  bi,
  narrative,
  brandColor,
}: {
  readonly bi: BrandIntelligence
  readonly narrative: readonly NarrativeSentence[]
  readonly brandColor: string
}) {
  const affinityLabel = AFFINITY_LABELS[bi.affinity] ?? bi.affinity

  return (
    <div className="space-y-4">
      {/* Brand-specific header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-10 rounded-full" style={{ backgroundColor: brandColor }} />
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {bi.brand} Expansion Intelligence
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-2 py-0.5 rounded-full border border-border bg-surface-1 font-medium text-foreground">
                {affinityLabel}
              </span>
              <span className="text-xs text-muted-foreground">
                Sweet spot: Income Deciles {bi.idealDecileRange}
              </span>
              <span className="text-xs text-muted-foreground">
                <TrendingUp size={11} className="inline mr-0.5" />
                {bi.affinityMatchRate}% of opportunities match
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Brand-specific KPIs */}
      <BrandKpiTiles bi={bi} />

      {/* Competitor context */}
      {bi.topCompetitor && (
        <div className="flex items-center gap-2 bg-surface-1 border border-border rounded-lg px-4 py-2.5">
          <Users size={13} className="text-muted-foreground shrink-0" />
          <p className="text-xs text-foreground">
            <span className="font-semibold">{bi.topCompetitor.brand}</span> validates demand at{" "}
            <span className="font-semibold">{bi.topCompetitor.overlapCount}</span> of your{" "}
            {bi.stationCount} whitespace stations — where they thrive, {bi.brand} is absent.
          </p>
        </div>
      )}

      {/* Top 5 one-pager with AI recommendations */}
      <TopStationsOnePager bi={bi} />

      {/* Narrative (generic, provides additional context) */}
      <NarrativeBlock sentences={narrative} />

      {/* AI Executive Summary — kept for full context */}
      {AI_EXECUTIVE_SUMMARY && (
        <details className="border border-purple-500/20 rounded-lg overflow-hidden">
          <summary className="px-4 py-2.5 bg-purple-500/5 cursor-pointer text-xs font-medium text-foreground hover:bg-purple-500/10 transition-colors flex items-center gap-2">
            <Sparkles size={13} className="text-purple-400" />
            <span className="text-purple-400 font-semibold uppercase tracking-wide">Full Market Analysis</span>
            <span className="text-[9px] text-muted-foreground ml-auto">Claude Opus 4.6</span>
          </summary>
          <div className="p-4 space-y-3 text-xs">
            <p className="text-sm text-foreground leading-relaxed">{AI_EXECUTIVE_SUMMARY.overview}</p>
            {AI_EXECUTIVE_SUMMARY.topPicks && (
              <div>
                <h4 className="text-[10px] uppercase tracking-wide text-purple-400/70 font-semibold mb-1">Top Picks</h4>
                <p className="text-foreground/80 leading-relaxed">{AI_EXECUTIVE_SUMMARY.topPicks}</p>
              </div>
            )}
            {AI_EXECUTIVE_SUMMARY.brandStrategy && (
              <div className="space-y-2 text-foreground/80 leading-relaxed">
                <p>{AI_EXECUTIVE_SUMMARY.brandStrategy}</p>
                <p>{AI_EXECUTIVE_SUMMARY.geographicClusters}</p>
                <p>{AI_EXECUTIVE_SUMMARY.driveThruOpportunities}</p>
              </div>
            )}
          </div>
        </details>
      )}

      <SourceRibbon />
      <MethodologySection />
    </div>
  )
}

// --- Generic Brief (multi-brand mode, unchanged) ---

function GenericBrief({
  kpis,
  narrative,
  brandLabel,
}: {
  readonly kpis: OpportunityKpis
  readonly narrative: readonly NarrativeSentence[]
  readonly brandLabel: string
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">
          Top Opportunities
          <span className="text-muted-foreground font-normal text-lg ml-2">for {brandLabel}</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Station-centric intelligence brief — each station analyzed across 6 data sources with cited evidence.
        </p>
      </div>

      <NarrativeBlock sentences={narrative} />

      {/* AI Executive Summary */}
      {AI_EXECUTIVE_SUMMARY && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-purple-400" />
            <span className="text-xs text-purple-400 font-semibold uppercase tracking-wide">AI Strategic Analysis</span>
            <span className="text-[9px] text-muted-foreground ml-auto">Claude Opus 4.6</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{AI_EXECUTIVE_SUMMARY.overview}</p>
          {AI_EXECUTIVE_SUMMARY.topPicks && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wide text-purple-400/70 font-semibold mb-1">Top Picks</h4>
              <p className="text-xs text-foreground/80 leading-relaxed">{AI_EXECUTIVE_SUMMARY.topPicks}</p>
            </div>
          )}
          {AI_EXECUTIVE_SUMMARY.brandStrategy && (
            <details className="text-xs">
              <summary className="text-purple-400/70 font-medium cursor-pointer hover:text-purple-400">
                Brand strategy + geographic clusters + drive-thru analysis
              </summary>
              <div className="mt-2 space-y-2 text-foreground/80 leading-relaxed">
                <p>{AI_EXECUTIVE_SUMMARY.brandStrategy}</p>
                <p>{AI_EXECUTIVE_SUMMARY.geographicClusters}</p>
                <p>{AI_EXECUTIVE_SUMMARY.driveThruOpportunities}</p>
              </div>
            </details>
          )}
        </div>
      )}

      <KpiTiles kpis={kpis} />
      <SourceRibbon />
      <MethodologySection />
    </div>
  )
}

// --- Main component ---

const ExecutiveBrief = ({ kpis, narrative, brandLabel, brandIntelligence }: ExecutiveBriefProps) => {
  const { brands } = useCountry()

  if (brandIntelligence) {
    const brandColor = brands[brandIntelligence.brand]?.color ?? "#6366f1"
    return (
      <BrandIntelligenceBrief
        bi={brandIntelligence}
        narrative={narrative}
        brandColor={brandColor}
      />
    )
  }

  return <GenericBrief kpis={kpis} narrative={narrative} brandLabel={brandLabel} />
}

export default ExecutiveBrief
