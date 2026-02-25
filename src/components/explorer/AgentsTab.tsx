import { TrendingUp, Crosshair, Compass, Truck } from "lucide-react"
import { AGENT_DEFINITIONS, type AgentId, type AgentInsight } from "@/lib/agent-engine"
import type { AgentStatus } from "@/hooks/useAgents"

interface AgentsTabProps {
  readonly insights: readonly AgentInsight[]
  readonly agentStatuses: ReadonlyMap<AgentId, AgentStatus>
}

const AGENT_ICONS: Record<AgentId, typeof TrendingUp> = {
  "market-monitor": TrendingUp,
  "competitor-tracker": Crosshair,
  "expansion-scout": Compass,
  "delivery-intel": Truck,
}

const AGENT_COLORS: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  emerald: {
    dot: "bg-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
  },
  red: {
    dot: "bg-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
  },
  purple: {
    dot: "bg-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
  },
  blue: {
    dot: "bg-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
  },
}

const AgentsTab = ({ insights, agentStatuses }: AgentsTabProps) => {
  return (
    <div className="space-y-4">
      {/* Agent cards */}
      <div className="space-y-2">
        {AGENT_DEFINITIONS.map((agent) => {
          const Icon = AGENT_ICONS[agent.id]
          const colors = AGENT_COLORS[agent.color] || AGENT_COLORS.emerald
          const status = agentStatuses.get(agent.id) || "idle"
          const agentInsights = insights.filter((i) => i.agentId === agent.id && !i.read)
          const isAlerting = status === "alerting"

          return (
            <div
              key={agent.id}
              className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <Icon className={`w-4 h-4 ${colors.text}`} />
                <span className="text-xs font-semibold text-foreground">{agent.name}</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span
                    className={`w-2 h-2 rounded-full ${colors.dot} ${
                      isAlerting ? "animate-pulse" : "opacity-50"
                    }`}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {isAlerting ? `${agentInsights.length} new` : "idle"}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {agent.tagline}
              </p>
            </div>
          )
        })}
      </div>

      {/* Latest insights preview */}
      {insights.length > 0 && (
        <div>
          <h4 className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">
            Latest Insights
          </h4>
          <div className="space-y-1.5">
            {insights.slice(0, 3).map((insight) => {
              const agent = AGENT_DEFINITIONS.find((a) => a.id === insight.agentId)
              const colors = agent ? AGENT_COLORS[agent.color] || AGENT_COLORS.emerald : AGENT_COLORS.emerald

              return (
                <div
                  key={insight.id}
                  className={`p-2 rounded-lg border text-xs ${
                    insight.read
                      ? "bg-surface-1 border-border text-muted-foreground"
                      : "bg-surface-1 border-blue-600/30 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-semibold ${colors.text}`}>
                      {agent?.name || insight.agentId}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {insight.timestamp}
                    </span>
                  </div>
                  <p className="leading-relaxed">{insight.message}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {insights.length === 0 && (
        <p className="text-muted-foreground text-xs py-4">
          Agents are analyzing market data...
        </p>
      )}
    </div>
  )
}

export default AgentsTab
