// Pure alert evaluation engine — no side effects

export type AlertRuleType = "threshold" | "change" | "competitor"

export interface AlertRule {
  readonly id: string
  readonly type: AlertRuleType
  readonly brand: string
  readonly region: string
  /** For "threshold": fire when brand count > value in region */
  readonly value?: number
  /** For "competitor": rival brand name */
  readonly rivalBrand?: string
  readonly label: string
}

export interface AlertEvent {
  readonly id: string
  readonly ruleId: string
  readonly type: AlertRuleType
  readonly message: string
  readonly timestamp: string // ISO date string representing the timeline month
  readonly read: boolean
}

export type Snapshot = Record<string, Record<string, number>>

/** Build a region→brand→count snapshot from open dates at a given month */
export function buildSnapshot(
  month: number,
  openDates: Record<string, readonly Date[]>,
  brandPoints: Record<string, readonly [number, number, string, string, string][]>,
  cityToRegion: Record<string, string>
): Snapshot {
  const cutoff = new Date(2015 + Math.floor(month / 12), month % 12, 1)
  const snapshot: Record<string, Record<string, number>> = {}

  for (const brand of Object.keys(openDates)) {
    const dates = openDates[brand]
    const points = brandPoints[brand] || []

    for (let i = 0; i < dates.length; i++) {
      if (dates[i] > cutoff) continue
      const city = points[i]?.[3]
      if (!city) continue
      const region = cityToRegion[city]
      if (!region) continue

      if (!snapshot[region]) snapshot[region] = {}
      snapshot[region][brand] = (snapshot[region][brand] || 0) + 1
    }
  }

  return snapshot
}

/** Evaluate rules against prev→next snapshot transition */
export function evaluateAlerts(
  rules: readonly AlertRule[],
  prevSnapshot: Snapshot,
  nextSnapshot: Snapshot,
  monthDate: string
): readonly AlertEvent[] {
  const events: AlertEvent[] = []

  for (const rule of rules) {
    const prevCount = prevSnapshot[rule.region]?.[rule.brand] || 0
    const nextCount = nextSnapshot[rule.region]?.[rule.brand] || 0

    switch (rule.type) {
      case "threshold": {
        const threshold = rule.value || 0
        if (prevCount <= threshold && nextCount > threshold) {
          events.push({
            id: `${rule.id}-${monthDate}`,
            ruleId: rule.id,
            type: "threshold",
            message: `${rule.brand} exceeded ${threshold} locations in ${rule.region} (now ${nextCount})`,
            timestamp: monthDate,
            read: false,
          })
        }
        break
      }

      case "change": {
        if (prevCount === 0 && nextCount > 0) {
          events.push({
            id: `${rule.id}-enter-${monthDate}`,
            ruleId: rule.id,
            type: "change",
            message: `${rule.brand} entered ${rule.region} (${nextCount} location${nextCount > 1 ? "s" : ""})`,
            timestamp: monthDate,
            read: false,
          })
        } else if (prevCount > 0 && nextCount === 0) {
          events.push({
            id: `${rule.id}-exit-${monthDate}`,
            ruleId: rule.id,
            type: "change",
            message: `${rule.brand} exited ${rule.region}`,
            timestamp: monthDate,
            read: false,
          })
        }
        break
      }

      case "competitor": {
        const rival = rule.rivalBrand || ""
        const prevRival = prevSnapshot[rule.region]?.[rival] || 0
        const nextRival = nextSnapshot[rule.region]?.[rival] || 0
        if (prevRival === 0 && nextRival > 0 && nextCount > 0) {
          events.push({
            id: `${rule.id}-rival-${monthDate}`,
            ruleId: rule.id,
            type: "competitor",
            message: `${rival} opened near ${rule.brand} in ${rule.region}`,
            timestamp: monthDate,
            read: false,
          })
        }
        break
      }
    }
  }

  return events
}
