// Shared signal strength bar — renders one signal with tier label + optional detail text
// Replaces 4 duplicated SIGNAL_META + bar implementations across deep dive views

import { signalTier } from "@/lib/signal-detail"

export const SIGNAL_META: Record<string, { label: string; color: string }> = {
  // Station signals (7)
  footfall: { label: "Footfall", color: "#6366f1" },
  brandGap: { label: "Brand gap", color: "#f43f5e" },
  demographic: { label: "Demo fit", color: "#06b6d4" },
  density: { label: "Low density", color: "#f59e0b" },
  pedestrian: { label: "Pedestrian", color: "#22c55e" },
  roadTraffic: { label: "Road traffic", color: "#8b5cf6" },
  workforceDensity: { label: "Workforce", color: "#ec4899" },
  // Junction signals (4) — trafficVolume, driveThruGap, qsrPresence, demographicFit
  trafficVolume: { label: "Traffic volume", color: "#6366f1" },
  driveThruGap: { label: "Drive-thru gap", color: "#f43f5e" },
  qsrPresence: { label: "QSR presence", color: "#22c55e" },
  demographicFit: { label: "Demographic fit", color: "#06b6d4" },
  // Zone signals (5) — brandGap (shared), qsrDensityGap, demographicFit (shared),
  //                      workforceDensity (shared), footfallProximity
  qsrDensityGap: { label: "QSR density gap", color: "#22c55e" },
  footfallProximity: { label: "Footfall proximity", color: "#6366f1" },
}

interface SignalStrengthBarProps {
  readonly signalKey: string
  readonly value: number // 0-100
  readonly fired: boolean
  readonly detail?: string | null
  readonly variant?: "full" | "compact"
}

export function SignalStrengthBar({
  signalKey,
  value,
  fired,
  detail,
  variant = "full",
}: SignalStrengthBarProps) {
  const meta = SIGNAL_META[signalKey] ?? { label: signalKey, color: "#888" }
  const tier = signalTier(value)
  const isCompact = variant === "compact"
  const labelWidth = isCompact ? "w-16" : "w-28"
  const tierWidth = isCompact ? "w-14" : "w-20"

  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] ${labelWidth} truncate ${fired ? "text-foreground" : "text-muted-foreground/40"}`}
        >
          {meta.label}
        </span>
        <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${fired ? Math.max(value, 2) : 0}%`,
              backgroundColor: fired ? meta.color : "hsl(var(--surface-3))",
            }}
          />
        </div>
        <span
          className={`text-[10px] ${tierWidth} text-right truncate font-medium ${tier.className}`}
        >
          {tier.label}
        </span>
      </div>
      {!isCompact && fired && detail && (
        <div className="text-[9px] text-muted-foreground mt-0.5 ml-[7.5rem]">
          {detail}
        </div>
      )}
    </div>
  )
}
