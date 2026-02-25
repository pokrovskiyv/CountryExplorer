// Discriminated union for combined alert + agent insight feed

import type { AlertEvent } from "./alert-engine"
import type { AgentInsight } from "./agent-engine"

export type FeedItem =
  | { readonly kind: "alert"; readonly data: AlertEvent }
  | { readonly kind: "insight"; readonly data: AgentInsight }

function getFeedTimestamp(item: FeedItem): string {
  return item.data.timestamp
}

/** Merge alerts and insights into a single feed, sorted newest-first */
export function mergeFeedItems(
  events: readonly AlertEvent[],
  insights: readonly AgentInsight[]
): readonly FeedItem[] {
  const alertItems: readonly FeedItem[] = events.map((data) => ({ kind: "alert" as const, data }))
  const insightItems: readonly FeedItem[] = insights.map((data) => ({ kind: "insight" as const, data }))

  return [...alertItems, ...insightItems].sort(
    (a, b) => getFeedTimestamp(b).localeCompare(getFeedTimestamp(a))
  )
}
