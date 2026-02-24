import { describe, it, expect } from "vitest";
import {
  computePenetrationGap,
  computeCompetitorPresence,
  computePopulationScore,
  computeDensityHeadroom,
  computeOpportunityScore,
  computeAllRegionScores,
  getScoreTier,
  DEFAULT_WEIGHTS,
  type ScoreBreakdown,
} from "@/lib/expansion-scoring";

describe("expansion-scoring", () => {
  describe("getScoreTier", () => {
    it("maps scores to correct tiers", () => {
      expect(getScoreTier(95)).toBe("Hot");
      expect(getScoreTier(80)).toBe("Hot");
      expect(getScoreTier(70)).toBe("Warm");
      expect(getScoreTier(60)).toBe("Warm");
      expect(getScoreTier(50)).toBe("Moderate");
      expect(getScoreTier(40)).toBe("Moderate");
      expect(getScoreTier(30)).toBe("Cool");
      expect(getScoreTier(20)).toBe("Cool");
      expect(getScoreTier(10)).toBe("Cold");
      expect(getScoreTier(0)).toBe("Cold");
    });
  });

  describe("computePenetrationGap", () => {
    it("returns scores in 0-100 range for all regions", () => {
      const scores = computePenetrationGap("Subway");
      Object.values(scores).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    it("gives higher scores to regions with lower brand density", () => {
      const scores = computePenetrationGap("Nandos");
      // Northern Ireland has 9 Nandos for 1.9M, London has 127 for 8.9M
      // NI density: 9/1903 = 0.0047, London: 127/8866 = 0.0143
      // NI should have higher penetration gap (more opportunity)
      expect(scores["Northern Ireland"]).toBeGreaterThan(scores["London"]);
    });
  });

  describe("computeCompetitorPresence", () => {
    it("returns scores in 0-100 range", () => {
      const scores = computeCompetitorPresence("Subway");
      Object.values(scores).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("computePopulationScore", () => {
    it("returns scores in 0-100 range", () => {
      const scores = computePopulationScore();
      Object.values(scores).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    it("gives highest score to most populated region", () => {
      const scores = computePopulationScore();
      // South East has highest population (9294)
      const maxRegion = Object.entries(scores).reduce((a, b) =>
        b[1] > a[1] ? b : a
      );
      expect(maxRegion[0]).toBe("South East (England)");
      expect(maxRegion[1]).toBe(100);
    });
  });

  describe("computeDensityHeadroom", () => {
    it("returns scores in 0-100 range", () => {
      const scores = computeDensityHeadroom();
      Object.values(scores).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("computeOpportunityScore", () => {
    it("returns weighted composite in 0-100 range", () => {
      const breakdown: ScoreBreakdown = {
        penetrationGap: 80,
        competitorPresence: 60,
        populationScore: 40,
        densityHeadroom: 20,
      };
      const score = computeOpportunityScore(breakdown, DEFAULT_WEIGHTS);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("returns 0 when all weights are 0", () => {
      const breakdown: ScoreBreakdown = {
        penetrationGap: 80,
        competitorPresence: 60,
        populationScore: 40,
        densityHeadroom: 20,
      };
      const zeroWeights = {
        penetrationGap: 0,
        competitorPresence: 0,
        populationScore: 0,
        densityHeadroom: 0,
      };
      expect(computeOpportunityScore(breakdown, zeroWeights)).toBe(0);
    });

    it("uses correct default weights", () => {
      const breakdown: ScoreBreakdown = {
        penetrationGap: 100,
        competitorPresence: 0,
        populationScore: 0,
        densityHeadroom: 0,
      };
      // With defaults: 35% penetration = 35 composite
      const score = computeOpportunityScore(breakdown, DEFAULT_WEIGHTS);
      expect(score).toBe(35);
    });
  });

  describe("computeAllRegionScores", () => {
    it("returns 12 regions sorted by composite descending", () => {
      const scores = computeAllRegionScores("Subway", DEFAULT_WEIGHTS);
      expect(scores.length).toBe(12);

      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i].composite).toBeGreaterThanOrEqual(scores[i + 1].composite);
      }
    });

    it("has correct tier for each score", () => {
      const scores = computeAllRegionScores("Nandos", DEFAULT_WEIGHTS);
      scores.forEach((s) => {
        expect(s.tier).toBe(getScoreTier(s.composite));
      });
    });

    it("Nandos: Northern Ireland has higher penetration gap than London", () => {
      const scores = computeAllRegionScores("Nandos", DEFAULT_WEIGHTS);
      const ni = scores.find((s) => s.region === "Northern Ireland");
      const london = scores.find((s) => s.region === "London");
      expect(ni).toBeDefined();
      expect(london).toBeDefined();
      // NI has far fewer Nandos per capita, so penetration gap is higher
      expect(ni!.breakdown.penetrationGap).toBeGreaterThan(london!.breakdown.penetrationGap);
    });

    it("Nandos: with penetration-heavy weights, NI outscores London", () => {
      const penetrationHeavy = {
        penetrationGap: 80,
        competitorPresence: 10,
        populationScore: 5,
        densityHeadroom: 5,
      };
      const scores = computeAllRegionScores("Nandos", penetrationHeavy);
      const ni = scores.find((s) => s.region === "Northern Ireland");
      const london = scores.find((s) => s.region === "London");
      expect(ni!.composite).toBeGreaterThan(london!.composite);
    });

    it("weight changes shift rankings", () => {
      const defaultScores = computeAllRegionScores("Subway", DEFAULT_WEIGHTS);
      const popHeavy = computeAllRegionScores("Subway", {
        penetrationGap: 0,
        competitorPresence: 0,
        populationScore: 100,
        densityHeadroom: 0,
      });

      // Top region with population-only weights should be most populated
      expect(popHeavy[0].region).toBe("South East (England)");
      // Rankings should differ from defaults
      expect(defaultScores[0].region).not.toBe(popHeavy[0].region);
    });

    it("handles zero-presence brand without NaN", () => {
      // PapaJohns has low presence in some regions
      const scores = computeAllRegionScores("PapaJohns", DEFAULT_WEIGHTS);
      scores.forEach((s) => {
        expect(Number.isNaN(s.composite)).toBe(false);
        expect(s.composite).toBeGreaterThanOrEqual(0);
        expect(s.composite).toBeLessThanOrEqual(100);
      });
    });

    it("includes correct brand count and population", () => {
      const scores = computeAllRegionScores("Nandos", DEFAULT_WEIGHTS);
      const london = scores.find((s) => s.region === "London");
      expect(london).toBeDefined();
      expect(london!.brandCount).toBe(127);
      expect(london!.population).toBe(8866);
    });
  });
});
