import { Map, Bot, TrendingUp, Bell, Radar, Download } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface Feature {
  readonly icon: LucideIcon
  readonly title: string
  readonly desc: string
}

const features: readonly Feature[] = [
  { icon: Map, title: "Interactive Intelligence Map", desc: "Choropleth map color-coded by density, market share, or per-capita penetration. Click any region to drill into brand-by-brand breakdowns." },
  { icon: TrendingUp, title: "10-Year Timeline", desc: "Scrub through 131 months of historical data. Watch brands expand, contract, and shift month by month — from January 2015 to today." },
  { icon: Bot, title: "AI Agent Team", desc: "Four specialized agents — Market Monitor, Competitor Tracker, Expansion Scout, and Delivery Intel — continuously analyze data and surface actionable insights." },
  { icon: Bell, title: "Smart Alerts", desc: "Get notified when competitors open or close locations in your key regions. Filter by brand, region, or event type." },
  { icon: Radar, title: "Expansion Radar", desc: "5-tier scoring system rates every region from Cold to Hot for your brand, factoring in competition, population, and growth trends." },
  { icon: Download, title: "Export & Brand Groups", desc: "Download region data as CSV. Create custom brand groups to track only the competitors that matter to your strategy." },
]

const Features = () => (
  <section id="features" className="max-w-[1100px] mx-auto py-24 px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Everything you need to outmaneuver the competition</h2>
      <p className="text-lg text-muted-foreground max-w-[600px] mx-auto">
        From high-level market overview to AI-generated insights, Country Explorer gives you the full competitive picture.
      </p>
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {features.map((f) => {
        const Icon = f.icon
        return (
          <div key={f.title} className="bg-surface-0 border border-border rounded-xl p-7 transition-colors hover:border-blue-600/25">
            <div className="w-11 h-11 bg-blue-600/10 rounded-xl flex items-center justify-center mb-4">
              <Icon className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        )
      })}
    </div>
  </section>
)

export default Features
