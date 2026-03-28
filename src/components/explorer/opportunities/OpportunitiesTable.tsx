// Opportunities Table — compact power-user view
// Station-grouped accordion rows with brand gaps inside

import { Fragment, useState } from "react"
import type { StationOpportunity } from "@/lib/opportunity-scoring"
import { fmt } from "@/lib/opportunity-scoring"
import { useCountry } from "@/contexts/CountryContext"

interface OpportunitiesTableProps {
  readonly stations: readonly StationOpportunity[]
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-surface-2 text-muted-foreground",
}

const OpportunitiesTable = ({ stations }: OpportunitiesTableProps) => {
  const { brands } = useCountry()
  const [expandedStation, setExpandedStation] = useState<string | null>(null)

  if (stations.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        No opportunities found for selected brands. Try selecting more brands.
      </p>
    )
  }

  const shown = stations.slice(0, 50)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-1 border-b border-border">
            <th className="text-left py-2 px-3 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold w-10">#</th>
            <th className="text-left py-2 px-3 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Score</th>
            <th className="text-left py-2 px-3 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Station</th>
            <th className="text-left py-2 px-3 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Region</th>
            <th className="text-right py-2 px-3 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Pax/yr</th>
            <th className="text-right py-2 px-3 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Bus stops</th>
            <th className="text-center py-2 px-3 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Gaps</th>
            <th className="text-center py-2 px-3 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Signals</th>
            <th className="text-center py-2 px-3 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Conf.</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((opp) => {
            const isExpanded = expandedStation === opp.station.name

            return (
              <Fragment key={opp.station.name}>
                <tr
                  onClick={() => setExpandedStation(isExpanded ? null : opp.station.name)}
                  className={`border-b border-border cursor-pointer transition-colors ${
                    isExpanded ? "bg-surface-1" : "hover:bg-surface-1/50"
                  }`}
                >
                  <td className="py-2 px-3 text-muted-foreground tabular-nums">{opp.rank}</td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      opp.compositeScore >= 80 ? "bg-emerald-500/15 text-emerald-400" :
                      opp.compositeScore >= 60 ? "bg-amber-500/15 text-amber-400" :
                      "bg-surface-2 text-muted-foreground"
                    }`}>
                      {opp.compositeScore}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-medium text-foreground">{opp.station.name}</td>
                  <td className="py-2 px-3 text-muted-foreground text-xs">{opp.station.region}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-foreground">{fmt(opp.station.annualEntries)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{opp.station.busStopCount800m ?? "—"}</td>
                  <td className="py-2 px-3 text-center">
                    <span className="text-red-400 font-medium text-xs">{opp.brandGaps.length}</span>
                  </td>
                  <td className="py-2 px-3 text-center tabular-nums text-xs text-foreground">{opp.signalCount}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLE[opp.confidence]}`}>
                      {opp.confidence}
                    </span>
                  </td>
                </tr>

                {isExpanded && (
                  <tr key={`${opp.station.name}-detail`}>
                    <td colSpan={9} className="p-0">
                      <div className="bg-surface-1/80 border-t border-border px-4 py-3 space-y-2">
                        {/* Brand gaps */}
                        {opp.brandGaps.map((bg) => (
                          <div key={bg.brand} className="flex items-center gap-3">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: brands[bg.brand]?.color ?? "#888" }}
                            />
                            <span className="text-sm font-medium text-foreground w-24">{bg.brand}</span>
                            <span className={`text-xs font-bold tabular-nums ${
                              bg.score >= 80 ? "text-emerald-400" :
                              bg.score >= 60 ? "text-amber-400" :
                              "text-muted-foreground"
                            }`}>
                              {bg.score}
                            </span>
                            <div className="flex gap-1 flex-wrap">
                              {bg.signals.filter((s) => s.fired).map((s) => (
                                <span
                                  key={s.name}
                                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-surface-2 text-foreground"
                                >
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* Present brands */}
                        <div className="text-xs text-muted-foreground mt-1">
                          Present: {opp.presentBrands.map((pb) => `${pb.brand} (${pb.count})`).join(", ") || "—"}
                        </div>

                        {/* Analysis highlights */}
                        <div className="text-xs text-muted-foreground">
                          Data completeness: {opp.analysis.dataCompleteness}%
                          {opp.analysis.missingDataNotes.length > 0 && (
                            <span className="text-amber-400/70 ml-1">
                              ({opp.analysis.missingDataNotes.join("; ")})
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {stations.length > 50 && (
        <div className="py-2 px-3 text-xs text-muted-foreground bg-surface-1 text-center">
          Showing top 50 of {stations.length} station opportunities
        </div>
      )}
    </div>
  )
}

export default OpportunitiesTable
