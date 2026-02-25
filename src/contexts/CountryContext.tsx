import { createContext, useContext } from "react"
import type { ReactNode } from "react"

export interface BrandInfo {
  readonly color: string
  readonly icon: string
}

export interface CountryConfig {
  readonly code: string
  readonly name: string
  readonly brands: Record<string, BrandInfo>
  readonly regionCounts: Record<string, Record<string, number>>
  readonly population: Record<string, number>
  readonly brandPoints: Record<string, readonly [number, number, string, string, string][]>
  readonly regionCentroids: Record<string, [number, number]>
  readonly interpolateColor: (t: number) => string
  readonly mapCenter: [number, number]
  readonly mapZoom: number
  readonly cityToRegion: Record<string, string>
}

const CountryContext = createContext<CountryConfig | null>(null)

export function useCountry(): CountryConfig {
  const ctx = useContext(CountryContext)
  if (!ctx) {
    throw new Error("useCountry must be used within a CountryProvider")
  }
  return ctx
}

interface CountryProviderProps {
  readonly config: CountryConfig
  readonly children: ReactNode
}

export function CountryProvider({ config, children }: CountryProviderProps) {
  return (
    <CountryContext.Provider value={config}>
      {children}
    </CountryContext.Provider>
  )
}
