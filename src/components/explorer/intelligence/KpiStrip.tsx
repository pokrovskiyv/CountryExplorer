import { useMemo } from "react"
import type { OpportunityKpis } from "@/lib/opportunity-scoring"
import type { Opportunity, AnchorType } from "@/lib/multi-anchor-types"

interface KpiStripProps {
  opportunities: readonly Opportunity[]
  kpis: OpportunityKpis
  brandLabel: string
  anchorFilter: AnchorType | "all"
}

const KpiStrip = ({ opportunities, kpis, brandLabel, anchorFilter }: KpiStripProps) => {
  const counts = useMemo(() => {
    let actNow = 0, evaluate = 0, monitor = 0
    let stations = 0, junctions = 0, zones = 0
    for (const o of opportunities) {
      if (o.compositeScore >= 80) actNow++
      else if (o.compositeScore >= 60) evaluate++
      else monitor++
      if (o.anchorType === "station") stations++
      else if (o.anchorType === "junction") junctions++
      else if (o.anchorType === "msoa") zones++
    }
    return { actNow, evaluate, monitor, stations, junctions, zones }
  }, [opportunities])

  const contextParts: string[] = []
  if (anchorFilter === "all" || anchorFilter === "station") contextParts.push(`${counts.stations} stations`)
  if (anchorFilter === "all" || anchorFilter === "junction") contextParts.push(`${counts.junctions} junctions`)
  if ((anchorFilter === "all" || anchorFilter === "msoa") && counts.zones > 0) contextParts.push(`${counts.zones} zones`)

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] bg-surface-0/92 backdrop-blur-sm border-b border-border px-5 py-2 flex items-center gap-6">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] text-muted-foreground">Act Now</span>
        <span className="text-lg font-bold text-emerald-400">{counts.actNow}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] text-muted-foreground">Evaluate</span>
        <span className="text-lg font-bold text-amber-400">{counts.evaluate}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] text-muted-foreground">Monitor</span>
        <span className="text-lg font-bold text-muted-foreground">{counts.monitor}</span>
      </div>
      <div className="w-px h-5 bg-border" />
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] text-muted-foreground">Avg Score</span>
        <span className="text-lg font-bold text-blue-400">{kpis.avgScore}</span>
      </div>
      <span className="ml-auto text-[10px] text-muted-foreground">
        {brandLabel} &middot; {contextParts.join(", ")}
      </span>
    </div>
  )
}

export default KpiStrip
