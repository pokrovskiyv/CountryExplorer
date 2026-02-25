import { useQuery } from "@tanstack/react-query"
import { fetchCountryConfig } from "@/lib/api/countries"
import { fetchBrandPoints } from "@/lib/api/brand-points"
import { COUNTRY_CONFIGS } from "@/data/country-configs"
import type { CountryConfig } from "@/contexts/CountryContext"

const STALE_TIME = 5 * 60 * 1000 // 5 minutes
const GC_TIME = 30 * 60 * 1000 // 30 minutes

async function fetchFullCountryConfig(code: string): Promise<CountryConfig> {
  const staticConfig = COUNTRY_CONFIGS[code]

  const [configData, brandPoints] = await Promise.all([
    fetchCountryConfig(code),
    fetchBrandPoints(code),
  ])

  return {
    ...configData,
    brandPoints,
    interpolateColor: staticConfig.interpolateColor,
  }
}

interface UseCountryDataResult {
  readonly config: CountryConfig
  readonly isLoading: boolean
  readonly isError: boolean
  readonly error: Error | null
}

export function useCountryData(code: string): UseCountryDataResult {
  const staticConfig = COUNTRY_CONFIGS[code]

  const { data, isLoading, isError, error } = useQuery<CountryConfig, Error>({
    queryKey: ["country-config", code],
    queryFn: () => fetchFullCountryConfig(code),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
    placeholderData: staticConfig,
  })

  return {
    config: data ?? staticConfig,
    isLoading,
    isError,
    error: error ?? null,
  }
}
