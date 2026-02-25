import { describe, it, expect } from "vitest"
import { AGENT_DEFINITIONS, type AgentInsight } from "@/lib/agent-engine"
import { buildSnapshot } from "@/lib/alert-engine"
import { OPEN_DATES } from "@/data/temporal-data"
import { COUNTRY_CONFIGS } from "@/data/country-configs"
import { mergeFeedItems } from "@/lib/feed-types"

describe("init insights feed diversity", () => {
  it("shows at least 3 agents and 4 types in first 15 items", () => {
    const countryConfig = COUNTRY_CONFIGS.uk
    const snapshot = buildSnapshot(131, OPEN_DATES, countryConfig.brandPoints, countryConfig.cityToRegion)
    const allInsights: AgentInsight[] = []

    for (const agent of AGENT_DEFINITIONS.filter(a => a.static)) {
      allInsights.push(...agent.run({}, {}, countryConfig, "static"))
    }

    for (const agent of AGENT_DEFINITIONS.filter(a => !a.static)) {
      const insights = agent.run(snapshot, snapshot, countryConfig, "initial")
      allInsights.push(...insights.filter(i => i.insightType !== "stagnant-market"))
    }

    const feed = mergeFeedItems([], allInsights)
    const first15 = feed.slice(0, 15)
    const agents = new Set(first15.map(f => f.kind === "insight" ? f.data.agentId : "alert"))
    const types = new Set(first15.map(f => f.kind === "insight" ? f.data.insightType : "alert"))

    expect(agents.size).toBeGreaterThanOrEqual(3)
    expect(types.size).toBeGreaterThanOrEqual(4)
  })

  it("caps delivery-intel insights to prevent feed flooding", () => {
    const countryConfig = COUNTRY_CONFIGS.uk
    const snapshot = buildSnapshot(131, OPEN_DATES, countryConfig.brandPoints, countryConfig.cityToRegion)
    const allInsights: AgentInsight[] = []

    for (const agent of AGENT_DEFINITIONS.filter(a => a.static)) {
      allInsights.push(...agent.run({}, {}, countryConfig, "static"))
    }

    const deliveryCount = allInsights.filter(i => i.agentId === "delivery-intel").length
    expect(deliveryCount).toBeLessThanOrEqual(10)
    expect(deliveryCount).toBeGreaterThan(0)

    // Verify type diversity within delivery-intel
    const deliveryTypes = new Set(
      allInsights.filter(i => i.agentId === "delivery-intel").map(i => i.insightType)
    )
    expect(deliveryTypes.size).toBeGreaterThanOrEqual(3)
  })
})
