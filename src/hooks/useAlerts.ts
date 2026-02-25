import { useState, useCallback, useEffect, useRef } from "react"
import {
  evaluateAlerts,
  buildSnapshot,
  type AlertRule,
  type AlertEvent,
  type Snapshot,
} from "@/lib/alert-engine"
import { OPEN_DATES } from "@/data/temporal-data"
import type { CountryConfig } from "@/contexts/CountryContext"

const RULES_KEY = "explorer-alert-rules"
const MAX_EVENTS = 100

function loadRules(): readonly AlertRule[] {
  try {
    const raw = localStorage.getItem(RULES_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveRules(rules: readonly AlertRule[]): void {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules))
}

export interface AlertsState {
  readonly rules: readonly AlertRule[]
  readonly events: readonly AlertEvent[]
  readonly unreadCount: number
  readonly addRule: (rule: Omit<AlertRule, "id">) => void
  readonly removeRule: (id: string) => void
  readonly markAllRead: () => void
}

export function useAlerts(
  currentMonth: number,
  countryConfig: CountryConfig
): AlertsState {
  const [rules, setRules] = useState<readonly AlertRule[]>(loadRules)
  const [events, setEvents] = useState<readonly AlertEvent[]>([])
  const prevMonthRef = useRef<number>(currentMonth)
  const prevSnapshotRef = useRef<Snapshot | null>(null)

  const addRule = useCallback((rule: Omit<AlertRule, "id">) => {
    const newRule: AlertRule = { ...rule, id: `rule-${Date.now()}` }
    setRules((prev) => {
      const next = [...prev, newRule]
      saveRules(next)
      return next
    })
  }, [])

  const removeRule = useCallback((id: string) => {
    setRules((prev) => {
      const next = prev.filter((r) => r.id !== id)
      saveRules(next)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setEvents((prev) => prev.map((e) => ({ ...e, read: true })))
  }, [])

  // Evaluate alerts when timeline month advances
  useEffect(() => {
    if (rules.length === 0) return
    if (currentMonth === prevMonthRef.current && prevSnapshotRef.current) return

    const { brandPoints, cityToRegion } = countryConfig

    const nextSnapshot = buildSnapshot(currentMonth, OPEN_DATES, brandPoints, cityToRegion)

    if (prevSnapshotRef.current && currentMonth > prevMonthRef.current) {
      const year = 2015 + Math.floor(currentMonth / 12)
      const monthOfYear = currentMonth % 12
      const monthDate = `${year}-${String(monthOfYear + 1).padStart(2, "0")}`

      const newEvents = evaluateAlerts(rules, prevSnapshotRef.current, nextSnapshot, monthDate)

      if (newEvents.length > 0) {
        setEvents((prev) => {
          const combined = [...newEvents, ...prev]
          return combined.slice(0, MAX_EVENTS)
        })
      }
    }

    prevSnapshotRef.current = nextSnapshot
    prevMonthRef.current = currentMonth
  }, [currentMonth, rules, countryConfig])

  const unreadCount = events.filter((e) => !e.read).length

  return {
    rules,
    events,
    unreadCount,
    addRule,
    removeRule,
    markAllRead,
  }
}
