// Geospatial utilities for distance calculations and proximity analysis
// Used by location intelligence agents and map popups

const EARTH_RADIUS_KM = 6371

/** Convert degrees to radians */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Calculate great-circle distance between two points using the haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/**
 * Count how many points fall within a given radius of a center point.
 * Points are [lat, lon, ...rest] tuples (matching brand-points format).
 */
export function countPointsInRadius(
  centerLat: number,
  centerLon: number,
  points: readonly (readonly [number, number, ...unknown[]])[],
  radiusKm: number,
): number {
  // Bounding-box pre-filter: ~0.009° per km latitude, ~0.015° per km longitude at UK
  const latTol = radiusKm * 0.009
  const lonTol = radiusKm * 0.015

  let count = 0
  for (const point of points) {
    const [lat, lon] = point
    if (
      Math.abs(lat - centerLat) > latTol ||
      Math.abs(lon - centerLon) > lonTol
    ) {
      continue
    }
    if (haversineDistance(centerLat, centerLon, lat, lon) <= radiusKm) {
      count++
    }
  }
  return count
}

interface NearestResult {
  readonly index: number
  readonly distance: number
}

/**
 * Find the N closest points to a center point.
 * Returns array sorted by distance (ascending).
 */
export function findNearestPoints(
  centerLat: number,
  centerLon: number,
  points: readonly (readonly [number, number, ...unknown[]])[],
  limit: number,
): readonly NearestResult[] {
  const results: { index: number; distance: number }[] = []

  for (let i = 0; i < points.length; i++) {
    const [lat, lon] = points[i]
    const dist = haversineDistance(centerLat, centerLon, lat, lon)
    results.push({ index: i, distance: dist })
  }

  return results
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
}

/** Format distance for display: "0.3 km" or "1.2 km" */
export function formatDistance(km: number): string {
  return km < 1
    ? `${Math.round(km * 1000)}m`
    : `${km.toFixed(1)}km`
}
