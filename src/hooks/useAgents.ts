import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { buildSnapshot, type Snapshot } from "@/lib/alert-engine"
import { runAllAgents, AGENT_DEFINITIONS, type AgentId, type AgentInsight } from "@/lib/agent-engine"
import { OPEN_DATES } from "@/data/temporal-data"
import type { CountryConfig } from "@/contexts/CountryContext"

const MAX_INSIGHTS = 70
const NOISY_ON_INIT: ReadonlySet<string> = new Set(["stagnant-market"])

const AGENT_IDS: readonly AgentId[] = ["market-monitor", "competitor-tracker"]

export type AgentStatus = "idle" | "alerting"

export interface AgentsState {
  readonly insights: readonly AgentInsight[]
  readonly unreadCount: number
  readonly agentStatuses: ReadonlyMap<AgentId, AgentStatus>
  readonly markAllRead: () => void
}

export function useAgents(
  currentMonth: number,
  countryConfig: CountryConfig
): AgentsState {
  const [insights, setInsights] = useState<readonly AgentInsight[]>([])
  const prevMonthRef = useRef<number>(currentMonth)
  const prevSnapshotRef = useRef<Snapshot | null>(null)

  const markAllRead = useCallback(() => {
    setInsights((prev) => prev.map((i) => ({ ...i, read: true })))
  }, [])

  // Run temporal agents: on mount (prev=next for state-based) and on month change
  useEffect(() => {
    const { brandPoints, cityToRegion } = countryConfig
    const nextSnapshot = buildSnapshot(currentMonth, OPEN_DATES, brandPoints, cityToRegion)

    if (!prevSnapshotRef.current) {
      // Initial run: prev=next produces state-based insights (market-leader, brand-dominance, brand-gap)
      const initialInsights: AgentInsight[] = []
      for (const agent of AGENT_DEFINITIONS) {
        const agentInsights = agent.run(nextSnapshot, nextSnapshot, countryConfig, "initial")
        initialInsights.push(
          ...agentInsights.filter((i) => !NOISY_ON_INIT.has(i.insightType))
        )
      }

      if (initialInsights.length > 0) {
        const sorted = [...initialInsights].sort((a, b) => a.priority - b.priority)
        setInsights(sorted.slice(0, MAX_INSIGHTS))
      }
    } else if (currentMonth > prevMonthRef.current) {
      // Timeline advanced: compare snapshots for change-based insights
      const year = 2015 + Math.floor(currentMonth / 12)
      const monthOfYear = currentMonth % 12
      const monthDate = `${year}-${String(monthOfYear + 1).padStart(2, "0")}`

      const newInsights = runAllAgents(
        prevSnapshotRef.current,
        nextSnapshot,
        countryConfig,
        monthDate
      )

      if (newInsights.length > 0) {
        setInsights((prev) => {
          const combined = [...newInsights, ...prev]
          return combined.slice(0, MAX_INSIGHTS)
        })
      }
    }

    prevSnapshotRef.current = nextSnapshot
    prevMonthRef.current = currentMonth
  }, [currentMonth, countryConfig])

  const unreadCount = useMemo(
    () => insights.filter((i) => !i.read).length,
    [insights]
  )

  const agentStatuses = useMemo(() => {
    const activeAgents = new Set(
      insights.filter((i) => !i.read).map((i) => i.agentId)
    )
    const statuses = new Map<AgentId, AgentStatus>()
    for (const id of AGENT_IDS) {
      statuses.set(id, activeAgents.has(id) ? "alerting" : "idle")
    }
    return statuses
  }, [insights])

  return {
    insights,
    unreadCount,
    agentStatuses,
    markAllRead,
  }
}
