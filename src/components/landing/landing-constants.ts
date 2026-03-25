import { TrendingUp, Crosshair, Compass, Truck, Activity, Users, Target } from "lucide-react"

export const AGENT_COLOR_TOKENS = {
  emerald: {
    dot: "bg-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
  red: {
    dot: "bg-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    gradient: "from-red-500/20 to-red-500/5",
  },
  purple: {
    dot: "bg-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
    gradient: "from-purple-500/20 to-purple-500/5",
  },
  blue: {
    dot: "bg-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    gradient: "from-blue-500/20 to-blue-500/5",
  },
  amber: {
    dot: "bg-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
  cyan: {
    dot: "bg-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    gradient: "from-cyan-500/20 to-cyan-500/5",
  },
  rose: {
    dot: "bg-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    text: "text-rose-400",
    gradient: "from-rose-500/20 to-rose-500/5",
  },
} as const

export const LANDING_AGENTS = [
  {
    id: "market-monitor",
    name: "Market Monitor",
    tagline: "Tracks growth trends and market dynamics across all regions",
    color: "emerald" as const,
    icon: TrendingUp,
    exampleInsight: "Subway added 12 locations in South East this quarter, growing 50% faster than average",
  },
  {
    id: "competitor-tracker",
    name: "Competitor Tracker",
    tagline: "Identifies competitive threats, brand dominance shifts, and market gaps",
    color: "red" as const,
    icon: Crosshair,
    exampleInsight: "KFC controls 38% market share in North West but is absent from Northern Ireland",
  },
  {
    id: "expansion-scout",
    name: "Expansion Scout",
    tagline: "Discovers high-potential expansion opportunities with 5-tier scoring",
    color: "purple" as const,
    icon: Compass,
    exampleInsight: "East Midlands upgraded from Warm to Hot for Domino's — score: 82/100",
  },
  {
    id: "delivery-intel",
    name: "Delivery Intel",
    tagline: "Analyzes delivery platform coverage and format mix across regions and brands",
    color: "blue" as const,
    icon: Truck,
    exampleInsight: "86% of McDonald's on Deliveroo vs 0% of Subway — platform coverage gap in South East",
  },
  {
    id: "human-flow",
    name: "Human Flow Analyst",
    tagline: "Overlays rail passenger volumes with QSR coverage to find underserved transit hubs",
    color: "amber" as const,
    icon: Activity,
    exampleInsight: "London Waterloo: 94M passengers/year but only 12 QSR within 800m — 4x below average for busy stations",
  },
  {
    id: "market-fit",
    name: "Market Fit Analyst",
    tagline: "Matches income profiles with brand positioning to find demographic-driven gaps",
    color: "cyan" as const,
    icon: Users,
    exampleInsight: "Nando's (premium brand) has 30% fewer locations per capita in East — despite it being a high-income region",
  },
  {
    id: "opportunity-engine",
    name: "Opportunity Engine",
    tagline: "Combines footfall, demographic, and competitive signals to surface convergent opportunities",
    color: "rose" as const,
    icon: Target,
    exampleInsight: "KFC at Leicester station: 3 signals align (high footfall + brand absent + demographic fit), score 87/100",
  },
] as const

export const SCREENSHOT_SLIDES = [
  {
    src: "/screenshots/map-regions.png",
    alt: "Map color-coded by restaurant density per region",
    label: "Regions",
    description: "Region-shaded map showing total locations, per-capita penetration, or market share across all UK regions",
  },
  {
    src: "/screenshots/map-points.png",
    alt: "Individual restaurant locations plotted on the map",
    label: "Points",
    description: "6,820+ individual restaurant locations plotted by brand — zoom in to explore every street-level cluster",
  },
  {
    src: "/screenshots/map-both.png",
    alt: "Combined region shading with individual point markers",
    label: "Both",
    description: "Region shading combined with individual point markers — see density context and exact locations at once",
  },
  {
    src: "/screenshots/map-heatmap.png",
    alt: "Heatmap showing restaurant concentration hotspots",
    label: "Heatmap",
    description: "Density heatmap reveals restaurant concentration hotspots — instantly spot underserved areas and clusters",
  },
  {
    src: "/screenshots/agents-tab-active.png",
    alt: "AI agent team generating competitive insights",
    label: "AI Agents",
    description: "Seven AI agents analyze market data, transit traffic, and demographics to surface actionable insights",
  },
  {
    src: "/screenshots/agents-tab-dark-mode.png",
    alt: "Full dark mode interface with agent insights",
    label: "Dark Mode",
    description: "Full dark mode support with the same powerful analytics — optimized for extended analysis sessions",
  },
] as const
