import { TrendingUp, Crosshair, Compass, Truck } from "lucide-react"

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
] as const

export const SCREENSHOT_SLIDES = [
  {
    src: "/screenshots/map-regions.png",
    alt: "Choropleth map color-coded by restaurant density per region",
    label: "Regions",
    description: "Choropleth map color-coded by total locations, per-capita penetration, or brand share across all UK regions",
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
    description: "Four AI agents analyze market data and surface actionable insights as you explore the timeline",
  },
  {
    src: "/screenshots/agents-tab-dark-mode.png",
    alt: "Full dark mode interface with agent insights",
    label: "Dark Mode",
    description: "Full dark mode support with the same powerful analytics — optimized for extended analysis sessions",
  },
] as const
