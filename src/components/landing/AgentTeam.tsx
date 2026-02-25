import { LANDING_AGENTS, AGENT_COLOR_TOKENS } from "./landing-constants"

const AgentTeam = () => (
  <section id="agents" className="max-w-[1100px] mx-auto py-24 px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
        Automated competitive analysis — always running
      </h2>
      <p className="text-lg text-muted-foreground max-w-[600px] mx-auto">
        Each agent specializes in a different competitive question. They run every time you explore the timeline — surfacing what the data means, not just what it shows.
      </p>
    </div>

    <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-6">
      {LANDING_AGENTS.map((agent) => {
        const colors = AGENT_COLOR_TOKENS[agent.color]
        const Icon = agent.icon

        return (
          <div
            key={agent.id}
            className={`rounded-xl border p-6 bg-gradient-to-b ${colors.gradient} ${colors.border} transition-colors`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${colors.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">{agent.name}</h3>
                  <span className={`w-2 h-2 rounded-full ${colors.dot} motion-safe:animate-pulse`} />
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {agent.tagline}
            </p>
            <div className="bg-surface-0 border border-border rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`text-[10px] font-semibold ${colors.text}`}>Example Insight</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {agent.exampleInsight}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  </section>
)

export default AgentTeam
