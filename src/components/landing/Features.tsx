import { Map, Bot, TrendingUp, Bell, Radar, Download } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface Feature {
  readonly icon: LucideIcon
  readonly title: string
  readonly desc: string
}

const features: readonly Feature[] = [
  { icon: Map, title: "See where competitors win", desc: "Region-shaded map reveals density, market share, and per-capita penetration. Click any region for a brand-by-brand breakdown." },
  { icon: TrendingUp, title: "Spot trends over 10 years", desc: "Scrub through 131 months of opening and closing data. Watch brands expand, contract, and shift — month by month since 2015." },
  { icon: Bot, title: "7 AI agents working for you", desc: "Specialized agents analyze competitive data, transit footfall, road traffic, and demographics to surface insights no spreadsheet reveals." },
  { icon: Bell, title: "Never miss a competitive move", desc: "Get notified when competitors open or close locations in your key regions. Filter by brand, region, or event type." },
  { icon: Radar, title: "Know where to expand next", desc: "5-tier scoring system rates every region from Cold to Hot for your brand — factoring in competition, population, and growth trends." },
  { icon: Download, title: "Export insights, track competitors", desc: "Download data as CSV. Create custom brand groups to track only the competitors that matter to your strategy." },
]

const Features = () => (
  <section id="features" className="max-w-[1100px] mx-auto py-24 px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Everything you need to outmaneuver the competition</h2>
      <p className="text-lg text-muted-foreground max-w-[600px] mx-auto">
        From high-level market overview to AI-generated insights, Getplace gives you the full competitive picture.
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
