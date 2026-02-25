// Discriminated union for combined alert + agent insight feed

import type { AlertEvent } from "./alert-engine"
import type { AgentInsight } from "./agent-engine"

export type FeedItem =
  | { readonly kind: "alert"; readonly data: AlertEvent }
  | { readonly kind: "insight"; readonly data: AgentInsight }

function getFeedTimestamp(item: FeedItem): string {
  return item.data.timestamp
}

function getFeedPriority(item: FeedItem): number {
  if (item.kind === "alert") return 2
  return item.data.priority
}

const NON_TEMPORAL = new Set(["static", "initial"])

function isTemporalTimestamp(ts: string): boolean {
  return !NON_TEMPORAL.has(ts)
}

/** Merge alerts and insights into a single feed.
 *  Timeline-generated items sort newest-first (by timestamp).
 *  Initial/static items sort by priority (highest first) to interleave agents.
 *  Temporal items always appear before initial items. */
export function mergeFeedItems(
  events: readonly AlertEvent[],
  insights: readonly AgentInsight[]
): readonly FeedItem[] {
  const alertItems: readonly FeedItem[] = events.map((data) => ({ kind: "alert" as const, data }))
  const insightItems: readonly FeedItem[] = insights.map((data) => ({ kind: "insight" as const, data }))

  const temporal: FeedItem[] = []
  const initial: FeedItem[] = []

  for (const item of [...alertItems, ...insightItems]) {
    if (isTemporalTimestamp(getFeedTimestamp(item))) {
      temporal.push(item)
    } else {
      initial.push(item)
    }
  }

  // Temporal: newest first
  temporal.sort((a, b) => getFeedTimestamp(b).localeCompare(getFeedTimestamp(a)))
  // Initial: group by priority, then round-robin by agent within each group
  // This ensures all agents are visible early in the feed
  const byPriority = new Map<number, FeedItem[]>()
  for (const item of initial) {
    const p = getFeedPriority(item)
    const arr = byPriority.get(p) || []
    byPriority.set(p, [...arr, item])
  }

  const interleaved: FeedItem[] = []
  const priorities = [...byPriority.keys()].sort((a, b) => a - b)

  for (const p of priorities) {
    const items = byPriority.get(p)!
    // Group by agent, then round-robin
    const byAgent = new Map<string, FeedItem[]>()
    for (const item of items) {
      const agent = item.kind === "insight" ? item.data.agentId : "_alert"
      const arr = byAgent.get(agent) || []
      byAgent.set(agent, [...arr, item])
    }

    const agentQueues = [...byAgent.values()]
    let idx = 0
    let remaining = items.length
    while (remaining > 0) {
      for (const queue of agentQueues) {
        if (idx < queue.length) {
          interleaved.push(queue[idx])
          remaining--
        }
      }
      idx++
    }
  }

  initial.length = 0
  initial.push(...interleaved)

  return [...temporal, ...initial]
}
