// Brand Dossier report sections
// DossierHeader, ExecutiveSummarySection, DataPipelineSection, IncomeAffinitySection

import { ArrowLeft, TrendingUp, Users, Database, Brain, Sparkles, CheckCircle2, XCircle } from "lucide-react"
import { Link } from "react-router-dom"
import type { IncomeAffinity } from "@/lib/opportunity-scoring"
import { AFFINITY_LABELS, SOURCE_RIBBON } from "@/components/explorer/opportunities/ExecutiveBrief"
import type { RegionAffinityRow } from "@/hooks/useBrandDossier"

// --- Header ---

interface DossierHeaderProps {
  readonly brand: string
  readonly brandColor: string
  readonly brandIcon: string
  readonly affinity: IncomeAffinity
  readonly idealDecileRange: string
}

export function DossierHeader({ brand, brandColor, brandIcon, affinity, idealDecileRange }: DossierHeaderProps) {
  const affinityLabel = AFFINITY_LABELS[affinity] ?? affinity

  return (
    <div className="space-y-4">
      <Link
        to="/explorer#opportunities"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Explorer
      </Link>

      <div className="h-1.5 rounded-full w-24" style={{ backgroundColor: brandColor }} />

      <div className="flex items-center gap-4">
        <span className="text-4xl">{brandIcon}</span>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {brand} Expansion Intelligence
          </h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs px-2.5 py-1 rounded-full border border-border bg-surface-1 font-medium text-foreground">
              {affinityLabel}
            </span>
            <span className="text-sm text-muted-foreground">
              Sweet spot: Income Deciles {idealDecileRange}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Executive Summary ---

interface ExecutiveSummaryProps {
  readonly stationCount: number
  readonly avgBrandScore: number
  readonly affinityMatchRate: number
  readonly idealDecileRange: string
  readonly topStationName: string
  readonly topStationScore: number
  readonly strategicThesis: string
  readonly topCompetitor: { readonly brand: string; readonly overlapCount: number } | null
  readonly stationCountTotal: number
  readonly brand: string
}

export function ExecutiveSummarySection({
  stationCount, avgBrandScore, affinityMatchRate, idealDecileRange,
  topStationName, topStationScore, strategicThesis, topCompetitor,
  stationCountTotal, brand,
}: ExecutiveSummaryProps) {
  const kpis = [
    { label: "Whitespace Locations", value: String(stationCount) },
    { label: "Avg Brand Score", value: `${avgBrandScore}/100` },
    { label: "Income Match", value: `${affinityMatchRate}%`, sub: `Deciles ${idealDecileRange}` },
    { label: "Top Location", value: topStationName, sub: `Score ${topStationScore}` },
  ]

  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">Executive Summary</h2>

      {/* KPI tiles */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-surface-1 border border-border rounded-lg p-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{kpi.label}</div>
            <div className="text-2xl font-bold text-foreground mt-1 truncate">{kpi.value}</div>
            {kpi.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* Strategic thesis */}
      <div className="bg-surface-1 border border-border rounded-lg p-5">
        <p className="text-sm text-foreground leading-relaxed">{strategicThesis}</p>
      </div>

      {/* Competitor validation */}
      {topCompetitor && (
        <div className="flex items-center gap-3 bg-surface-1 border border-border rounded-lg px-5 py-3">
          <Users size={16} className="text-muted-foreground shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">{topCompetitor.brand}</span> validates demand at{" "}
            <span className="font-semibold">{topCompetitor.overlapCount}</span> of your{" "}
            {stationCountTotal} whitespace stations — where they thrive, {brand} is absent.
          </p>
        </div>
      )}
    </section>
  )
}

// --- Data Pipeline ("How We Know") ---

const PIPELINE_SOURCES = SOURCE_RIBBON.map((s) => ({
  ...s,
  type: s.name === "Getplace" ? "GP" as const : "GOV" as const,
}))

const SIGNALS = [
  { name: "Footfall", weight: "25%", condition: "Station > 1M passengers/yr" },
  { name: "Brand Gap", weight: "25%", condition: "Brand absent, competitors present" },
  { name: "Demo Fit", weight: "15%", condition: "Income decile matches brand" },
  { name: "Low Density", weight: "15%", condition: "QSR count < 75% of average" },
  { name: "Pedestrian", weight: "8%", condition: "30+ bus stops within 800m" },
  { name: "Road Traffic", weight: "7%", condition: "50K+ vehicles/day, < 2 drive-thru" },
  { name: "Workforce", weight: "5%", condition: "20K+ workers within 1.5km (Census)" },
] as const

export function DataPipelineSection() {
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">How We Know</h2>
      <p className="text-sm text-muted-foreground">
        Every number in this report traces to a specific government dataset. No surveys, no estimates, no gut feel.
      </p>

      {/* 3-column pipeline visual */}
      <div className="grid grid-cols-3 gap-4">
        {/* Column 1: Data Sources */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
            <Database size={12} />
            6 Data Sources
          </div>
          {PIPELINE_SOURCES.map((src) => (
            <div key={src.name} className="bg-surface-1 border border-border rounded-md px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{src.name}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  src.type === "GOV"
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-emerald-500/15 text-emerald-400"
                }`}>
                  {src.type}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">{src.records}</div>
            </div>
          ))}
        </div>

        {/* Column 2: Scoring Engine */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
            <TrendingUp size={12} />
            7-Signal Scoring
          </div>
          {SIGNALS.map((sig) => (
            <div key={sig.name} className="bg-surface-1 border border-border rounded-md px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{sig.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{sig.weight}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">{sig.condition}</div>
            </div>
          ))}
        </div>

        {/* Column 3: AI Analysis */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
            <Brain size={12} />
            AI Analysis
          </div>
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-md px-3 py-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-purple-400" />
              <span className="text-xs text-purple-400 font-semibold">Claude Opus 4.6</span>
            </div>
            <p className="text-[11px] text-foreground/80 leading-relaxed">
              Reviews top 30 stations and generates per-brand strategic recommendations, risk assessments, and action tiers.
            </p>
            <div className="space-y-1.5 text-[10px] text-foreground/70">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Brand-specific fit analysis
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Risk mitigation per station
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                Action tier classification
              </div>
            </div>
          </div>
          <div className="bg-surface-1 border border-border rounded-md px-3 py-2 text-center">
            <div className="text-[10px] text-muted-foreground">Formula</div>
            <div className="text-[10px] font-mono text-foreground mt-1">
              Score = sum(w x s) x conf
            </div>
          </div>
        </div>
      </div>

      {/* Flow arrows */}
      <div className="flex items-center justify-center gap-2 text-muted-foreground/40 text-xs">
        <span>Raw government data</span>
        <span>→</span>
        <span>Weighted multi-signal scoring</span>
        <span>→</span>
        <span>AI strategic interpretation</span>
        <span>→</span>
        <span className="text-foreground font-medium">Actionable recommendations</span>
      </div>
    </section>
  )
}

// --- Income Affinity ---

interface IncomeAffinityProps {
  readonly regionData: readonly RegionAffinityRow[]
  readonly brandColor: string
  readonly idealDecileRange: string
  readonly brand: string
}

export function IncomeAffinitySection({ regionData, brandColor, idealDecileRange, brand }: IncomeAffinityProps) {
  const deciles = Array.from({ length: 10 }, (_, i) => i + 1)
  const [rangeMin, rangeMax] = idealDecileRange.split("-").map(Number)
  const matchingRegions = regionData.filter((r) => r.isInSweetSpot)

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Income Affinity Match</h2>
      <p className="text-sm text-muted-foreground">
        {brand}'s sweet spot is income Deciles {idealDecileRange}.{" "}
        {matchingRegions.length} of {regionData.length} regions fall in this range.
      </p>

      <div className="bg-surface-1 border border-border rounded-lg p-5 space-y-3">
        {/* Decile header */}
        <div className="flex items-center gap-2">
          <div className="w-40 text-[10px] text-muted-foreground font-medium">Region</div>
          <div className="flex-1 flex">
            {deciles.map((d) => (
              <div
                key={d}
                className="flex-1 text-center text-[9px] text-muted-foreground/60"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="w-16 text-[10px] text-muted-foreground text-right">Stations</div>
          <div className="w-6" />
        </div>

        {/* Region rows */}
        {regionData.map((row) => {
          // Shorten long region names
          const shortName = row.region
            .replace(" (England)", "")
            .replace("Yorkshire and The Humber", "Yorkshire")

          return (
            <div key={row.region} className="flex items-center gap-2">
              <div className="w-40 text-xs text-foreground truncate" title={row.region}>
                {shortName}
              </div>
              <div className="flex-1 flex gap-0.5">
                {deciles.map((d) => {
                  const isActive = d === row.medianIncomeDecile
                  const isInRange = d >= rangeMin && d <= rangeMax

                  return (
                    <div
                      key={d}
                      className="flex-1 h-5 rounded-sm transition-colors"
                      style={{
                        backgroundColor: isActive
                          ? brandColor
                          : isInRange
                            ? `${brandColor}15`
                            : "hsl(var(--surface-2))",
                        opacity: isActive ? 1 : undefined,
                      }}
                    />
                  )
                })}
              </div>
              <div className="w-16 text-xs text-foreground tabular-nums text-right">
                {row.stationCount > 0 ? row.stationCount : "—"}
              </div>
              <div className="w-6 flex justify-center">
                {row.isInSweetSpot ? (
                  <CheckCircle2 size={13} className="text-emerald-400" />
                ) : (
                  <XCircle size={13} className="text-muted-foreground/30" />
                )}
              </div>
            </div>
          )
        })}

        {/* Legend */}
        <div className="flex items-center gap-4 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: brandColor }} />
            Region's median decile
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${brandColor}15` }} />
            {brand}'s sweet spot (Deciles {idealDecileRange})
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={11} className="text-emerald-400" />
            Match
          </div>
        </div>
      </div>
    </section>
  )
}
