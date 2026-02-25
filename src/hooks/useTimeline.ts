import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { OPEN_DATES } from "@/data/temporal-data"

const MIN_MONTH = 0    // Jan 2015
const MAX_MONTH = 131  // Dec 2025

export interface TimelineState {
  readonly currentMonth: number
  readonly isPlaying: boolean
  readonly speed: number
  readonly setCurrentMonth: (month: number) => void
  readonly togglePlay: () => void
  readonly setSpeed: (speed: number) => void
  readonly visibleIndices: Record<string, ReadonlySet<number>>
  readonly currentDate: Date
}

function monthToDate(month: number): Date {
  return new Date(2015 + Math.floor(month / 12), month % 12, 1)
}

export function getVisibleIndicesForMonth(
  month: number,
  openDates: Record<string, readonly Date[]> = OPEN_DATES
): Record<string, ReadonlySet<number>> {
  const cutoff = monthToDate(month)
  const result: Record<string, ReadonlySet<number>> = {}

  for (const brand of Object.keys(openDates)) {
    const dates = openDates[brand]
    const indices = new Set<number>()
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] <= cutoff) {
        indices.add(i)
      }
    }
    result[brand] = indices
  }

  return result
}

export function useTimeline(): TimelineState {
  const [currentMonth, setCurrentMonth] = useState(MAX_MONTH)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev) {
        // If at the end, restart from beginning
        setCurrentMonth((m) => (m >= MAX_MONTH ? MIN_MONTH : m))
      }
      return !prev
    })
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setCurrentMonth((prev) => {
        const next = prev + 1
        if (next > MAX_MONTH) {
          setIsPlaying(false)
          return MAX_MONTH
        }
        return next
      })
    }, 200 / speed)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPlaying, speed])

  const visibleIndices = useMemo(
    () => getVisibleIndicesForMonth(currentMonth),
    [currentMonth]
  )

  const currentDate = useMemo(() => monthToDate(currentMonth), [currentMonth])

  return {
    currentMonth,
    isPlaying,
    speed,
    setCurrentMonth,
    togglePlay,
    setSpeed,
    visibleIndices,
    currentDate,
  }
}
