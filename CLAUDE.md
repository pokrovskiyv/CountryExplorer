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
- **Opportunity scoring** (`src/lib/opportunity-scoring.ts`) — Scores locations for QSR expansion potential using demographic, traffic, and station data. 7-signal weighted model. Demographic signal uses UK-wide normalized income deciles from 4 national deprivation indices.
- **Explorer** (`src/components/explorer/`) — Main interactive map + data exploration interface.
- **Map layers** (`src/hooks/map-layers/types.ts`, inline in `MapView.tsx`) — Toggleable data overlays. Each layer is a self-contained `useEffect` in MapView using `mapRef.current` directly. Current layers:
  - **Station analysis** — merged footfall + opportunity score. Size = passenger volume, color = opportunity confidence (green/amber/gray). Rich popup with QSR coverage, brand gaps, and 7-signal breakdown.
  - **Road traffic flow** — heatmap + drive-thru opportunity markers. Filter: high-traffic roads only (50K+ vehicles/day).
  - **Income level** / **Deprivation index** — demographic overlays that recolor all 12 UK region polygons. Data from IMD 2025 (England), WIMD 2025 (Wales), SIMD 2020v2 (Scotland), NIMDM 2017 (N. Ireland). `imdColor` uses dynamic min/max range. Tooltips show source and micro-area label per nation. Use `demoActiveStylesRef` to preserve colors during hover.
- **Layer UI** (`src/components/explorer/LayerPanel.tsx`, `MapLegend.tsx`) — Categorized toggle panel ("Stations & Opportunities", "Road Traffic", "Demographics") with per-layer descriptions + dynamic legend.
- **Landing page** (`src/components/landing/`) — Marketing landing page with early access flow. Headline: "Find your next 50 locations before competitors do." Links open Insights view.
- **Radar** (`src/components/radar/`) — Expansion radar visualization with region ranking.

### Path aliases

`@/*` maps to `./src/*` (configured in tsconfig and vite).

## UI Structure

- **Header tabs**: Insights (default) | Map | Table | Radar
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
- Default Explorer view is `"opportunities"` (set in `readViewFromHash()` fallback)
- Demographic overlays mutate shared region layer styles. `demoActiveStylesRef` stores applied styles so hover handlers restore demographic colors (not original choropleth) on mouseout
- When demographic overlay is active, the custom brand tooltip is suppressed to avoid overlapping with Leaflet's sticky tooltip
- Station analysis layer merges old "stations" + "opportunities" into one — `oppByStation` Map links station names to opportunity scores
