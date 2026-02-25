// Pure aggregation of per-point delivery attributes into region-level stats
// Used by the delivery-intel agent to generate competitive intelligence insights

import type { PointAttributes } from "@/data/brand-attributes"

export interface RegionDeliveryStats {
  readonly total: number
  readonly deliveroo: number
  readonly uberEats: number
  readonly justEat: number
  readonly ownDelivery: number
  readonly driveThru: number
  readonly clickAndCollect: number
  readonly anyThirdParty: number // deliveroo || uberEats || justEat
}

// region → brand → stats
export type DeliverySnapshot = Record<string, Record<string, RegionDeliveryStats>>

function emptyStats(): RegionDeliveryStats {
  return {
    total: 0,
    deliveroo: 0,
    uberEats: 0,
    justEat: 0,
    ownDelivery: 0,
    driveThru: 0,
    clickAndCollect: 0,
    anyThirdParty: 0,
  }
}

function addPoint(stats: RegionDeliveryStats, attrs: PointAttributes): RegionDeliveryStats {
  const { delivery, driveThru, clickAndCollect } = attrs
  const isThirdParty = delivery.deliveroo || delivery.uberEats || delivery.justEat
  return {
    total: stats.total + 1,
    deliveroo: stats.deliveroo + (delivery.deliveroo ? 1 : 0),
    uberEats: stats.uberEats + (delivery.uberEats ? 1 : 0),
    justEat: stats.justEat + (delivery.justEat ? 1 : 0),
    ownDelivery: stats.ownDelivery + (delivery.ownDelivery ? 1 : 0),
    driveThru: stats.driveThru + (driveThru ? 1 : 0),
    clickAndCollect: stats.clickAndCollect + (clickAndCollect ? 1 : 0),
    anyThirdParty: stats.anyThirdParty + (isThirdParty ? 1 : 0),
  }
}

function mergeStats(a: RegionDeliveryStats, b: RegionDeliveryStats): RegionDeliveryStats {
  return {
    total: a.total + b.total,
    deliveroo: a.deliveroo + b.deliveroo,
    uberEats: a.uberEats + b.uberEats,
    justEat: a.justEat + b.justEat,
    ownDelivery: a.ownDelivery + b.ownDelivery,
    driveThru: a.driveThru + b.driveThru,
    clickAndCollect: a.clickAndCollect + b.clickAndCollect,
    anyThirdParty: a.anyThirdParty + b.anyThirdParty,
  }
}

/** Build a snapshot of delivery stats aggregated by region and brand */
export function buildDeliverySnapshot(
  brandPoints: Record<string, readonly [number, number, string, string, string][]>,
  brandAttributes: Record<string, readonly PointAttributes[]>,
  cityToRegion: Record<string, string>,
): DeliverySnapshot {
  const snapshot: Record<string, Record<string, RegionDeliveryStats>> = {}

  for (const brand of Object.keys(brandAttributes)) {
    const points = brandPoints[brand] || []
    const attrs = brandAttributes[brand] || []
    const count = Math.min(points.length, attrs.length)

    for (let i = 0; i < count; i++) {
      const city = points[i][3]
      const region = cityToRegion[city]
      if (!region) continue

      if (!snapshot[region]) snapshot[region] = {}
      const prev = snapshot[region][brand] || emptyStats()
      snapshot[region][brand] = addPoint(prev, attrs[i])
    }
  }

  return snapshot
}

/** Aggregate all regions into national-level stats for a single brand */
export function computeNationalStats(
  snapshot: DeliverySnapshot,
  brand: string,
): RegionDeliveryStats {
  let result = emptyStats()

  for (const regionBrands of Object.values(snapshot)) {
    const brandStats = regionBrands[brand]
    if (brandStats) {
      result = mergeStats(result, brandStats)
    }
  }

  return result
}
