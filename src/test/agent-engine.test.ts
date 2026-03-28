import { describe, it, expect } from "vitest"
import {
  runAllAgents,
  AGENT_DEFINITIONS,
  type AgentInsight,
} from "@/lib/agent-engine"
import type { Snapshot } from "@/lib/alert-engine"
import { COUNTRY_CONFIGS } from "@/data/country-configs"

const ukConfig = COUNTRY_CONFIGS.uk

// Helper to run a single agent by ID
function runAgent(
  agentId: string,
  prev: Snapshot,
  next: Snapshot,
  monthDate = "2020-06"
): readonly AgentInsight[] {
  const agent = AGENT_DEFINITIONS.find((a) => a.id === agentId)
  if (!agent) throw new Error(`Agent ${agentId} not found`)
  return agent.run(prev, next, ukConfig, monthDate)
}

describe("agent-engine", () => {
  describe("Market Monitor", () => {
    it("detects rapid-growth when brand adds 3+ locations", () => {
      const prev: Snapshot = { London: { Subway: 10, McDonalds: 5 } }
      const next: Snapshot = { London: { Subway: 14, McDonalds: 5 } }
      const insights = runAgent("market-monitor", prev, next)
      const rapid = insights.filter((i) => i.insightType === "rapid-growth")
      expect(rapid).toHaveLength(1)
      expect(rapid[0].message).toContain("Subway")
      expect(rapid[0].message).toContain("added 4")
      expect(rapid[0].region).toBe("London")
    })

    it("does not fire rapid-growth for <3 growth", () => {
      const prev: Snapshot = { London: { Subway: 10 } }
      const next: Snapshot = { London: { Subway: 12 } }
      const insights = runAgent("market-monitor", prev, next)
      const rapid = insights.filter((i) => i.insightType === "rapid-growth")
      expect(rapid).toHaveLength(0)
    })

    it("detects regional-leader-shift when top brand changes", () => {
      const prev: Snapshot = { Wales: { Subway: 20, McDonalds: 15 } }
      const next: Snapshot = { Wales: { Subway: 18, McDonalds: 22 } }
      const insights = runAgent("market-monitor", prev, next)
      const shift = insights.filter((i) => i.insightType === "regional-leader-shift")
      expect(shift).toHaveLength(1)
      expect(shift[0].message).toContain("McDonalds")
      expect(shift[0].message).toContain("overtook")
      expect(shift[0].message).toContain("Subway")
    })

    it("does not fire leader-shift if leader unchanged", () => {
      const prev: Snapshot = { Wales: { Subway: 20, McDonalds: 15 } }
      const next: Snapshot = { Wales: { Subway: 25, McDonalds: 18 } }
      const insights = runAgent("market-monitor", prev, next)
      const shift = insights.filter((i) => i.insightType === "regional-leader-shift")
      expect(shift).toHaveLength(0)
    })

    it("detects stagnant-market when zero net openings", () => {
      const prev: Snapshot = { Scotland: { Subway: 10, KFC: 5 } }
      const next: Snapshot = { Scotland: { Subway: 10, KFC: 5 } }
      const insights = runAgent("market-monitor", prev, next)
      const stagnant = insights.filter((i) => i.insightType === "stagnant-market")
      expect(stagnant).toHaveLength(1)
      expect(stagnant[0].message).toContain("zero net openings")
    })

    it("detects market-leader for the leading brand in top regions", () => {
      const snapshot: Snapshot = {
        London: { Subway: 100, McDonalds: 50, KFC: 30 },
        Wales: { Subway: 20, McDonalds: 40, KFC: 10 },
      }
      const insights = runAgent("market-monitor", snapshot, snapshot)
      const leaders = insights.filter((i) => i.insightType === "market-leader")
      expect(leaders).toHaveLength(2)
      // London is larger (180 total) so Subway should lead there
      const londonLeader = leaders.find((i) => i.region === "London")
      expect(londonLeader).toBeDefined()
      expect(londonLeader!.brands).toContain("Subway")
      // Wales: McDonalds leads
      const walesLeader = leaders.find((i) => i.region === "Wales")
      expect(walesLeader).toBeDefined()
      expect(walesLeader!.brands).toContain("McDonalds")
    })

    it("detects market-acceleration for fast-growing brand", () => {
      const prev: Snapshot = {
        London: { Subway: 10, McDonalds: 10, KFC: 10 },
        Wales: { Subway: 10, McDonalds: 10, KFC: 10 },
      }
      const next: Snapshot = {
        London: { Subway: 20, McDonalds: 11, KFC: 11 },
        Wales: { Subway: 20, McDonalds: 11, KFC: 11 },
      }
      const insights = runAgent("market-monitor", prev, next)
      const accel = insights.filter((i) => i.insightType === "market-acceleration")
      expect(accel.length).toBeGreaterThanOrEqual(1)
      expect(accel[0].message).toContain("Subway")
      expect(accel[0].message).toContain("faster than average")
    })
  })

  describe("Competitor Tracker", () => {
    it("detects brand-dominance when share >35%", () => {
      const prev: Snapshot = { London: { Subway: 40, McDonalds: 10 } }
      const next: Snapshot = { London: { Subway: 40, McDonalds: 10 } }
      const insights = runAgent("competitor-tracker", prev, next)
      const dominance = insights.filter((i) => i.insightType === "brand-dominance")
      expect(dominance.length).toBeGreaterThanOrEqual(1)
      const subwayDom = dominance.find((i) => i.brands.includes("Subway"))
      expect(subwayDom).toBeDefined()
      expect(subwayDom!.message).toContain("80%")
    })

    it("detects competitive-entry when brand enters rival territory", () => {
      const prev: Snapshot = { London: { McDonalds: 35 } }
      const next: Snapshot = { London: { McDonalds: 35, KFC: 2 } }
      const insights = runAgent("competitor-tracker", prev, next)
      const entry = insights.filter((i) => i.insightType === "competitive-entry")
      expect(entry.length).toBeGreaterThanOrEqual(1)
      expect(entry[0].message).toContain("KFC")
      expect(entry[0].message).toContain("McDonalds")
    })

    it("detects flanking-threat when two brands expand together", () => {
      const prev: Snapshot = { Wales: { Subway: 10, KFC: 5 } }
      const next: Snapshot = { Wales: { Subway: 13, KFC: 8 } }
      const insights = runAgent("competitor-tracker", prev, next)
      const flanking = insights.filter((i) => i.insightType === "flanking-threat")
      expect(flanking).toHaveLength(1)
      expect(flanking[0].message).toContain("Subway")
      expect(flanking[0].message).toContain("KFC")
    })

    it("detects brand-gap for established brand absent from region", () => {
      const prev: Snapshot = {
        London: { Subway: 60 },
        Wales: { McDonalds: 10 },
      }
      const next: Snapshot = {
        London: { Subway: 60 },
        Wales: { McDonalds: 10 },
      }
      const insights = runAgent("competitor-tracker", prev, next)
      const gap = insights.filter(
        (i) => i.insightType === "brand-gap" && i.brands.includes("Subway") && i.region === "Wales"
      )
      expect(gap).toHaveLength(1)
      expect(gap[0].message).toContain("absent from Wales")
    })
  })

  describe("Initial insights (prev=next)", () => {
    it("produces state-based insights from both temporal agents when prev=next", () => {
      // Build a snapshot from real UK config
      const snapshot: Snapshot = {}
      for (const [region, counts] of Object.entries(ukConfig.regionCounts)) {
        snapshot[region] = { ...counts }
      }

      // Run all temporal agents with prev=next (simulates page load)
      const NOISY_ON_INIT = new Set(["stagnant-market"])
      const allInsights: AgentInsight[] = []
      for (const agent of AGENT_DEFINITIONS) {
        const insights = agent.run(snapshot, snapshot, ukConfig, "initial")
        allInsights.push(...insights.filter((i) => !NOISY_ON_INIT.has(i.insightType)))
      }

      // Both temporal agents should produce visible insights
      const agentIds = new Set(allInsights.map((i) => i.agentId))
      expect(agentIds.has("market-monitor"), "market-monitor should produce market-leader").toBe(true)
      expect(agentIds.has("competitor-tracker"), "competitor-tracker should produce brand-dominance").toBe(true)

      // Verify specific state-based insight types fire
      expect(allInsights.filter((i) => i.insightType === "market-leader").length).toBeGreaterThanOrEqual(1)
      expect(allInsights.filter((i) => i.insightType === "brand-dominance").length).toBeGreaterThanOrEqual(1)

      // Change-based insights should NOT fire
      const changeTypes = ["rapid-growth", "regional-leader-shift", "market-acceleration", "competitive-entry", "flanking-threat"]
      for (const type of changeTypes) {
        expect(allInsights.filter((i) => i.insightType === type), `${type} should not fire`).toHaveLength(0)
      }
    })

    it("stagnant-market fires for all regions when prev=next (should be filtered by hook)", () => {
      const snapshot: Snapshot = {}
      for (const [region, counts] of Object.entries(ukConfig.regionCounts)) {
        snapshot[region] = { ...counts }
      }

      const insights = runAgent("market-monitor", snapshot, snapshot, "initial")
      const stagnant = insights.filter((i) => i.insightType === "stagnant-market")
      // With prev=next, every region with data fires stagnant-market
      expect(stagnant.length).toBeGreaterThanOrEqual(1)
    })

    it("brand-gap fires for brands absent from some regions when prev=next", () => {
      const snapshot: Snapshot = {
        London: { Subway: 60 },
        Wales: { McDonalds: 10 },
      }
      const insights = runAgent("competitor-tracker", snapshot, snapshot, "initial")
      const gaps = insights.filter((i) => i.insightType === "brand-gap")
      expect(gaps.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("runAllAgents", () => {
    it("returns insights sorted by priority", () => {
      const prev: Snapshot = {
        London: { Subway: 10, McDonalds: 5 },
        Wales: { Subway: 20, McDonalds: 15 },
      }
      const next: Snapshot = {
        London: { Subway: 14, McDonalds: 5 },
        Wales: { Subway: 18, McDonalds: 22 },
      }
      const insights = runAllAgents(prev, next, ukConfig, "2020-06")
      // Verify sorted by priority
      for (let i = 1; i < insights.length; i++) {
        expect(insights[i].priority).toBeGreaterThanOrEqual(insights[i - 1].priority)
      }
    })

    it("includes insights from both agents", () => {
      // Build a scenario that triggers both agents
      const prev: Snapshot = {}
      const next: Snapshot = {}
      for (const region of Object.keys(ukConfig.population)) {
        prev[region] = { Subway: 10, McDonalds: 10 }
        next[region] = { Subway: 15, McDonalds: 10 }
      }
      const insights = runAllAgents(prev, next, ukConfig, "2020-06")
      const agentIds = new Set(insights.map((i) => i.agentId))
      // At minimum, market-monitor should fire (rapid-growth for Subway)
      expect(agentIds.has("market-monitor")).toBe(true)
    })

    it("generates unique IDs for each insight", () => {
      const prev: Snapshot = { London: { Subway: 10 } }
      const next: Snapshot = { London: { Subway: 14 } }
      const insights = runAllAgents(prev, next, ukConfig, "2020-06")
      const ids = insights.map((i) => i.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it("all insights have read: false", () => {
      const prev: Snapshot = { London: { Subway: 10 } }
      const next: Snapshot = { London: { Subway: 14 } }
      const insights = runAllAgents(prev, next, ukConfig, "2020-06")
      for (const insight of insights) {
        expect(insight.read).toBe(false)
      }
    })
  })

  describe("AGENT_DEFINITIONS", () => {
    it("has exactly 2 agents", () => {
      expect(AGENT_DEFINITIONS).toHaveLength(2)
    })

    it("each agent has required fields", () => {
      for (const agent of AGENT_DEFINITIONS) {
        expect(agent.id).toBeTruthy()
        expect(agent.name).toBeTruthy()
        expect(agent.tagline).toBeTruthy()
        expect(agent.color).toBeTruthy()
        expect(typeof agent.run).toBe("function")
      }
    })

    it("agent IDs are unique", () => {
      const ids = AGENT_DEFINITIONS.map((a) => a.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })
})
