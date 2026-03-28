# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite, port 8080)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest watch mode
python3 scripts/generate-internal-presentation.py  # Regenerate Internal Presentation (.docx)
```

Run a single test file: `npx vitest run src/test/agent-engine.test.ts`

## Architecture

**Getplace** — an insights-first location intelligence platform for QSR (Quick Service Restaurant) expansion analysis. Default view is **Insights** (opportunities), not Map.

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn-ui
- **Backend**: Supabase (PostgreSQL + Auth)
- **Maps**: Leaflet.js with heatmap layers + toggleable data overlays
- **State**: React Context + React Query (no Redux/Zustand)
- **Testing**: Vitest + React Testing Library (jsdom environment)

### Key subsystems

- **Agent system** (`src/lib/*-agent.ts`, `src/lib/agent-engine.ts`) — Custom-built AI agent orchestration for market analysis. Agents: human-flow, market-fit, opportunity-engine, delivery-intel.
- **Multi-anchor opportunity scoring** — Three anchor types scored and ranked in a unified list:
  - **Station scoring** (`src/lib/opportunity-scoring.ts`) — 7-signal weighted model for 517 train stations. Signals: footfall, brand gap, demographic, density, pedestrian, road traffic, workforce.
  - **Junction scoring** (`src/lib/junction-scoring.ts`) — 4-signal drive-thru focused model for 5,000 high-traffic road segments (50K+ AADF). Signals: traffic volume, drive-thru gap, QSR presence, demographic fit. Diamond markers on map, tied to "Road traffic flow" layer toggle.
  - **MSOA zone scoring** (`src/lib/msoa-scoring.ts`) — 4-signal area-level model for ~1,100+ MSOA zones (5K+ workplace pop). Signals: workforce density, QSR density gap, demographic fit, footfall proximity. Computed lazily from `WORKPLACE_POP` centroids.
  - **Unified types** (`src/lib/multi-anchor-types.ts`) — Discriminated union `Opportunity = StationOpportunityV2 | JunctionOpportunity | MsoaOpportunity`. All produce 0-100 composite score. Adapter `toStationOpportunityV2()` wraps legacy station type.
  - **Signal display** (`src/lib/signal-detail.ts`, `src/components/explorer/intelligence/SignalStrengthBar.tsx`) — Shared signal presentation layer. Replaces abstract 0-100 numbers with qualitative tier labels ("Very strong"/"Strong"/"Moderate"/"Weak") + real-world detail text (e.g., "125K vehicles/day"). `signalTier()` maps scores to tiers (80+/55+/30+/1+/0). Detail resolvers: `junctionSignalDetail()`, `zoneSignalDetail()` for junction/zone anchors; station signals use `Signal.rawValue` directly.
  - **Unified hook** (`src/hooks/useMultiAnchorOpportunities.ts`) — Calls all 3 scoring engines, merges into ranked `Opportunity[]`, supports anchor type filter (all/station/junction/msoa).
- **Smart Map** (`src/components/explorer/SmartMapView.tsx`) — Unified "Map & Insights" tab combining full interactive map (60%) with Intelligence Panel (40%). Progressive disclosure: overview → deep dive. Key features:
  - **KPI Strip** (`intelligence/KpiStrip.tsx`) — Act Now / Evaluate / Monitor counts + avg score, shows anchor type breakdown.
  - **Intelligence Panel** (`intelligence/IntelligencePanel.tsx`) — State machine: overview | station | junction | zone. Renders contextual deep dive.
  - **Overview** (`intelligence/OverviewState.tsx`) — Collapsible executive brief, anchor type filter chips (All/Stations/Junctions/Zones), tier filter (Act Now/Evaluate/Monitor), sort (Score/Traffic/Gaps), scrollable opportunity cards.
  - **OpportunityCard** (`intelligence/OpportunityCard.tsx`) — Polymorphic by `anchorType`: circle badge for stations (pax/yr, gaps, bus stops), diamond badge for junctions (AADF, drive-thru, road name), square badge for zones (workers, gaps, QSR count).
  - **SignalStrengthBar** (`intelligence/SignalStrengthBar.tsx`) — Shared signal bar component used by all deep dives. Unified `SIGNAL_META` (single source of truth for all signal labels + colors). Two variants: `full` (tier label + real-world detail text below bar) and `compact` (tier label only, for grid layouts). Tier logic in `src/lib/signal-detail.ts`.
  - **StationDeepDive** (`intelligence/StationDeepDive.tsx`) — Score, metrics grid, 7 signal bars (full variant, detail from `signal.rawValue`), brands within 800m, AI recommendation, demand evidence, risks.
  - **JunctionDeepDive** (`intelligence/JunctionDeepDive.tsx`) — Score, AADF, drive-thru saturation, signal bars (full variant, detail from `junctionSignalDetail()`), demand evidence, risks.
  - **ZoneDeepDive** (`intelligence/ZoneDeepDive.tsx`) — Score, workplace pop, brand gaps, signal bars (full variant, detail from `zoneSignalDetail()`), demand/risk evidence. Falls back to basic `useLocationContext` when opened from map click (no opportunity data).
  - **Map-panel sync** — Card hover highlights marker, card click flies map to location with 800m circle (stations) or 1.5km circle (zones), back restores previous view.
- **Explorer** (`src/components/explorer/`) — Main interactive map + data exploration interface.
- **Map layers** (`src/hooks/map-layers/types.ts`, inline in `MapView.tsx`) — Toggleable data overlays. Each layer is a self-contained `useEffect` in MapView using `mapRef.current` directly. MapView accepts `variant?: "default" | "smart-map"` — smart-map variant adds `onStationSelect`, `focusedStation` (800m circle + temp marker), `highlightedStation` (pulse), and junction diamond markers (tied to traffic layer). Current layers:
  - **Station analysis** — merged footfall + opportunity score. Size = passenger volume, color = opportunity confidence (green/amber/gray). Rich popup with QSR coverage, brand gaps, and 7-signal breakdown.
  - **Road traffic flow** — heatmap + drive-thru junction diamond markers (smart-map only, top 200). Filter: high-traffic roads only (50K+ vehicles/day).
  - **Income level** — MSOA-level choropleth (6,938 polygons) showing estimated annual salary in pounds (£23K–£35K). Computed from BRES employment by LA × SIC section × ASHE 2023 median pay. Granularity: Local Authority level (331 unique values mapped to MSOAs via `msoa-names-lad.csv`). TopoJSON: `public/msoa-salary-topo.json` (5.7 MB). Hook: `useIncomeGranularLayer`. Generated by `scripts/convert-salary-msoa.py`.
  - **Deprivation index** — MSOA-level choropleth (7,263 polygons, England & Wales). LSOA deprivation scores aggregated to MSOA via point-in-polygon. Data from IMD 2025 (England) + WIMD 2025 (Wales). TopoJSON loaded on demand from `public/msoa-deprivation-topo.json` (6 MB). Hook: `useDeprivationGranularLayer`. Generated by `scripts/convert-deprivation-msoa.py`. Clicking an MSOA polygon opens the Context Panel.
  - **People density** — `L.heatLayer` combining station footfall (2,361 points, log-weighted by annual passengers) + MSOA workplace population (7,264 points from Census 2021 WP001). Data lazy-loaded via `import()`. Hook: `usePeopleDensityLayer`. Gradient: dark blue → cyan → yellow → orange.
- **Context Panel** (`src/components/explorer/ContextPanel.tsx`) — Right-side slide-in panel triggered by clicking an MSOA polygon or restaurant marker. Shows: plain-language insight (rules-based, no AI), nearby brands within 1km with gaps highlighted, nearest station with opportunity score. Data computed at click time via `useLocationContext` hook using `geo-utils.ts` proximity functions. Mutually exclusive with RegionPanel.
- **Layer UI** (`src/components/explorer/LayerPanel.tsx`, `MapLegend.tsx`) — Categorized toggle panel ("Stations & Opportunities", "Road Traffic", "Demographics") with per-layer descriptions + dynamic legend.
- **Landing page** (`src/components/landing/`) — Marketing landing page with early access flow. Headline: "Find your next 50 locations before competitors do." Links open Insights view.
- **Radar** (`src/components/radar/`) — Expansion radar visualization with region ranking.
- **Internal Presentation** (`scripts/generate-internal-presentation.py`) — Python script (python-docx) generating `Getplace_Internal_Presentation.docx`. Structure: insight-first opening (3-insight table), market sizing + ROI + before/after, 3 case studies (Drive-thru M25/Custom House station/Zone #668 workforce), each with Signal Table + Demand Evidence (GOV/GP tagged) + Risks & Caveats + screenshots, simplified architecture with confidence scoring, AI agents with business value, competitive comparison, business impact, technical appendix. Screenshots in `screenshots/`. Regenerate: `python3 scripts/generate-internal-presentation.py`.

### Path aliases

`@/*` maps to `./src/*` (configured in tsconfig and vite).

## UI Structure

- **Header tabs**: Insights (default) | Map & Insights | Map | Table | Radar
- **Sidebar sections**: Brand Groups → Brands → Data Layers → Map Style → Country Summary
- **Map Style** merges "Shade regions by" (Total/Per 100k/Market share) + "Display mode" (Regions/Points/Both/Heatmap) in one section
- **No jargon**: "Choropleth" → "Regions", "AADF" → "vehicles/day", "IMD" → "Deprivation index", "Per 100k pop." → "Per 100k people"

## Conventions

- **Package manager**: npm (not bun, despite bun.lockb existing)
- **Branches**: `feat/description`, `fix/description`, `chore/description`
- **Commits**: conventional commits — `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- **Components**: functional components with hooks, no class components
- **Styling**: Tailwind CSS utility classes + shadcn-ui components; CSS variables for theming (HSL)
- **TypeScript**: lenient config (`strict: false`) — don't add strict checks unless asked

## Gotchas

- Supabase credentials use `VITE_` prefix (client-side accessible by design — these are publishable keys)
- `bun.lockb` exists but use npm — do not run `bun install`
- Vitest globals are enabled — no need to import `describe`, `it`, `expect`
- shadcn-ui components live in `src/components/ui/` — do not modify them directly, use the CLI to update
- Map overlays use `mapRef.current` (not state) in useEffect — state-based map instance caused reactivity issues with the orchestrator pattern
- Layer toggle deps use `activeLayers.has("id")` (boolean primitive) for reliable effect triggering
- Default Explorer view is `"opportunities"` (set in `readViewFromHash()` fallback). Smart Map is `"smart-map"` — added as new tab alongside existing ones for safe rollback
- Income level layer is a separate `L.geoJSON` layer (like deprivation). Salary is LA-level: all MSOAs in the same Local Authority share the same value, creating visible "blocks" at LA boundaries. Range £23K–£35K is narrow because it's industry-mix weighted average, not individual salaries
- Deprivation index layer is a separate `L.geoJSON` layer (not region recoloring). TopoJSON fetched lazily from `public/`, converted via `topojson.feature()`. Click handler uses `clickRef` (useRef) to avoid re-creating 7.2K polygons on callback identity change
- People density heatmap lazy-loads `workplace-pop-data.ts` (182 KB) via dynamic `import()` — code-split, not in initial bundle. Workplace weight = 0.6 to balance against station footfall (3x fewer points but higher intensity)
- Context Panel and RegionPanel are mutually exclusive — opening one closes the other via `contextTarget` / `selectedRegion` state in Explorer.tsx
- Restaurant markers use `pointsPane` (z-index 605, above `regionInteractionPane` at 600) so click events reach markers instead of being intercepted by the invisible region hover layer
- Station analysis layer merges old "stations" + "opportunities" into one — `oppByStation` Map links station names to opportunity scores
- Smart Map uses `ResizeObserver` + `invalidateSize()` in MapView to handle flex layout — without this, Leaflet renders partial map
- Junction diamond markers are tied to `activeLayers.has("traffic")` — they only appear when the Road Traffic layer is active
- SmartMapView holds `mapInstanceRef` via `onMapReady` callback from MapView — used for flyTo on card clicks and back navigation
- Zone highlight in SmartMapView uses 1.5km cyan circle + pin marker at MSOA centroid — cleaned up on navigation
- MSOA scoring (`msoa-scoring.ts`) iterates 7,265 WORKPLACE_POP entries with `countPointsInRadius` for each brand — memoized on `allBrands`, runs once (~2-3s)
- `MsoaOpportunity` uses synthetic `msoaCode` (`MSOA-00001`) since MSOA codes aren't in WORKPLACE_POP — zone names are generic ("Zone London #668")
- `ZoneDeepDive` accepts optional `MsoaOpportunity` prop — shows rich scoring data when opened from opportunity list, falls back to basic `useLocationContext` when opened from map polygon click
- Signal bars use `SignalStrengthBar` component with unified `SIGNAL_META` — do not add per-view `SIGNAL_META` copies. Station signals carry `rawValue` (human-readable text set at scoring time); junction/zone signals resolve detail text via `junctionSignalDetail()` / `zoneSignalDetail()` in `signal-detail.ts`. The `"brandGap"` key is shared between station and zone anchors with different semantics — station uses `Signal.rawValue`, zone uses `zoneSignalDetail()`
