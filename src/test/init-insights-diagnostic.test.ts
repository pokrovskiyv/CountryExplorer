import { describe, it, expect } from "vitest"
import { AGENT_DEFINITIONS, type AgentInsight } from "@/lib/agent-engine"
import { buildSnapshot } from "@/lib/alert-engine"
import { OPEN_DATES } from "@/data/temporal-data"
import { COUNTRY_CONFIGS } from "@/data/country-configs"
import { mergeFeedItems } from "@/lib/feed-types"

describe("init insights feed diversity", () => {
  it("shows at least 2 agents and 2 types in first 15 items", () => {
    const countryConfig = COUNTRY_CONFIGS.uk
    const snapshot = buildSnapshot(131, OPEN_DATES, countryConfig.brandPoints, countryConfig.cityToRegion)
    const allInsights: AgentInsight[] = []

    for (const agent of AGENT_DEFINITIONS) {
      const insights = agent.run(snapshot, snapshot, countryConfig, "initial")
      allInsights.push(...insights.filter(i => i.insightType !== "stagnant-market"))
    }

    const feed = mergeFeedItems([], allInsights)
    const first15 = feed.slice(0, 15)
    const agents = new Set(first15.map(f => f.kind === "insight" ? f.data.agentId : "alert"))
    const types = new Set(first15.map(f => f.kind === "insight" ? f.data.insightType : "alert"))

    expect(agents.size).toBeGreaterThanOrEqual(2)
    expect(types.size).toBeGreaterThanOrEqual(2)
  })
})
