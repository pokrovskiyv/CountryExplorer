// Signal detail resolvers — map abstract 0-100 scores to real-world descriptions
// Station signals already have `rawValue` on the Signal interface, no resolver needed

import type { JunctionOpportunity, MsoaOpportunity } from "./multi-anchor-types"
import { fmt } from "./opportunity-scoring"
import { fmtJunctionAadf } from "./junction-scoring"

export interface SignalTier {
  readonly label: string
  readonly className: string
}

export function signalTier(value: number): SignalTier {
  if (value >= 80) return { label: "Very strong", className: "text-emerald-400" }
  if (value >= 55) return { label: "Strong", className: "text-foreground" }
  if (value >= 30) return { label: "Moderate", className: "text-amber-400" }
  if (value > 0) return { label: "Weak", className: "text-muted-foreground" }
  return { label: "\u2014", className: "text-muted-foreground/30" }
}

export function junctionSignalDetail(
  key: string,
  opp: JunctionOpportunity,
): string | null {
  switch (key) {
    case "trafficVolume":
      return `${fmtJunctionAadf(opp.trafficPoint.aadf)} vehicles/day`
    case "driveThruGap":
      return opp.driveThruCount === 0
        ? "No drive-thru nearby"
        : `${opp.driveThruCount} drive-thru within 1.5km`
    case "qsrPresence":
      return `${opp.qsrCount} QSR within 1.5km`
    case "demographicFit":
      return opp.signalProfile.demographicFit > 0
        ? "Income matches brand"
        : null
    default:
      return null
  }
}

export function zoneSignalDetail(
  key: string,
  opp: MsoaOpportunity,
  brandCount: number,
): string | null {
  switch (key) {
    case "brandGap":
      return `${opp.brandGaps.length} of ${brandCount} brands absent`
    case "qsrDensityGap":
      return `${opp.qsrCount} QSR within 1.5km`
    case "demographicFit":
      return opp.signalProfile.demographicFit > 0
        ? "Income matches brand"
        : null
    case "workforceDensity":
      return `${fmt(opp.analysis.workplacePop)} workers`
    case "footfallProximity":
      return opp.analysis.nearestStation
        ? `${opp.analysis.nearestStation.name} ${opp.analysis.nearestStation.distance.toFixed(1)}km`
        : null
    default:
      return null
  }
}
