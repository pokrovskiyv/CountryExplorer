// Builds HTML content for map marker popups with optional delivery attributes

import type { PointAttributes } from "@/data/brand-attributes"

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Build popup HTML for a brand location marker */
export function buildPopupHtml(
  brand: string,
  point: readonly [number, number, string, string, string],
  attrs?: PointAttributes,
): string {
  const [, , address, city, postcode] = point
  let html = `<b>${escapeHtml(brand)}</b><br>${escapeHtml(address)}<br>${escapeHtml(city)} ${escapeHtml(postcode)}`

  if (!attrs) return html

  // Delivery platform badges
  const platforms: string[] = []
  if (attrs.delivery.deliveroo) platforms.push("Deliveroo")
  if (attrs.delivery.uberEats) platforms.push("Uber Eats")
  if (attrs.delivery.justEat) platforms.push("Just Eat")
  if (attrs.delivery.ownDelivery) platforms.push("Own Delivery")

  if (platforms.length > 0) {
    html += `<br><span style="color:#6b7280;font-size:11px">${platforms.join(" · ")}</span>`
  }

  // Format badges
  const badges: string[] = []
  if (attrs.driveThru) badges.push("Drive-Thru")
  if (attrs.clickAndCollect) badges.push("Click & Collect")

  if (badges.length > 0) {
    html += `<br><span style="color:#6b7280;font-size:11px">${badges.join(" · ")}</span>`
  }

  return html
}
