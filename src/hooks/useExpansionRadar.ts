import { useState, useMemo, useCallback } from "react";
import {
  computeAllRegionScores,
  DEFAULT_WEIGHTS,
  type OpportunityWeights,
  type RegionScore,
} from "@/lib/expansion-scoring";
import type { BrandInfo } from "@/contexts/CountryContext";

export interface ExpansionRadarState {
  readonly targetBrand: string;
  readonly setTargetBrand: (brand: string) => void;
  readonly weights: OpportunityWeights;
  readonly setWeights: (weights: OpportunityWeights) => void;
  readonly resetWeights: () => void;
  readonly scores: readonly RegionScore[];
  readonly topOpportunities: readonly RegionScore[];
  readonly selectedRegion: string | null;
  readonly setSelectedRegion: (region: string | null) => void;
  readonly getRegionScore: (region: string) => RegionScore | undefined;
}

interface ScoringData {
  readonly brands: Record<string, BrandInfo>;
  readonly regionCounts: Record<string, Record<string, number>>;
  readonly population: Record<string, number>;
}

export function useExpansionRadar(active: boolean, data: ScoringData): ExpansionRadarState {
  const [targetBrand, setTargetBrand] = useState("Subway");
  const [weights, setWeights] = useState<OpportunityWeights>(DEFAULT_WEIGHTS);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const scores = useMemo(() => {
    if (!active) return [];
    return computeAllRegionScores(targetBrand, weights, data);
  }, [targetBrand, weights, active, data]);

  const topOpportunities = useMemo(() => scores.slice(0, 3), [scores]);

  const getRegionScore = useCallback(
    (region: string) => scores.find((s) => s.region === region),
    [scores]
  );

  const resetWeights = useCallback(() => setWeights(DEFAULT_WEIGHTS), []);

  return {
    targetBrand,
    setTargetBrand,
    weights,
    setWeights,
    resetWeights,
    scores,
    topOpportunities,
    selectedRegion,
    setSelectedRegion,
    getRegionScore,
  };
}
