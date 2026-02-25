import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { buildSnapshot, type Snapshot } from "@/lib/alert-engine"
import { runAllAgents, AGENT_DEFINITIONS, type AgentId, type AgentInsight } from "@/lib/agent-engine"
import { OPEN_DATES } from "@/data/temporal-data"
import type { CountryConfig } from "@/contexts/CountryContext"

const MAX_INSIGHTS = 50
const NOISY_ON_INIT: ReadonlySet<string> = new Set(["stagnant-market"])

const AGENT_IDS: readonly AgentId[] = ["market-monitor", "competitor-tracker", "expansion-scout", "delivery-intel"]

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
  const staticRanRef = useRef(false)

  const markAllRead = useCallback(() => {
    setInsights((prev) => prev.map((i) => ({ ...i, read: true })))
  }, [])

  // Run all agents once on mount: static agents + temporal agents with same snapshot
  useEffect(() => {
    if (staticRanRef.current) return
    staticRanRef.current = true

    const allInitialInsights: AgentInsight[] = []

    // Run static agents (delivery-intel)
    const staticAgents = AGENT_DEFINITIONS.filter((a) => a.static)
    for (const agent of staticAgents) {
      allInitialInsights.push(
        ...agent.run({}, {}, countryConfig, "static")
      )
    }

    // Run temporal agents once with same snapshot (state-based insights only)
    const { brandPoints, cityToRegion } = countryConfig
    const snapshot = buildSnapshot(currentMonth, OPEN_DATES, brandPoints, cityToRegion)

    for (const agent of AGENT_DEFINITIONS) {
      if (agent.static) continue
      const insights = agent.run(snapshot, snapshot, countryConfig, "initial")
      allInitialInsights.push(
        ...insights.filter((i) => !NOISY_ON_INIT.has(i.insightType))
      )
    }

    if (allInitialInsights.length > 0) {
      const sorted = [...allInitialInsights].sort((a, b) => a.priority - b.priority)
      setInsights((prev) => {
        const withoutInitial = prev.filter(
          (i) => i.timestamp !== "static" && i.timestamp !== "initial"
        )
        return [...sorted, ...withoutInitial].slice(0, MAX_INSIGHTS)
      })
    }
  }, [countryConfig, currentMonth])

  // Run temporal agents when timeline month advances
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
