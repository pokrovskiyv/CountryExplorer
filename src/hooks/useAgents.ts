import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { buildSnapshot, type Snapshot } from "@/lib/alert-engine"
import { runAllAgents, type AgentId, type AgentInsight } from "@/lib/agent-engine"
import { OPEN_DATES } from "@/data/temporal-data"
import type { CountryConfig } from "@/contexts/CountryContext"

const MAX_INSIGHTS = 50

const AGENT_IDS: readonly AgentId[] = ["market-monitor", "competitor-tracker", "expansion-scout"]

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

  // Run agents when timeline month advances
  useEffect(() => {
    if (currentMonth === prevMonthRef.current && prevSnapshotRef.current) return

    const { brandPoints, cityToRegion } = countryConfig
    const nextSnapshot = buildSnapshot(currentMonth, OPEN_DATES, brandPoints, cityToRegion)

    if (prevSnapshotRef.current && currentMonth > prevMonthRef.current) {
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
