# Smart Map: Unified Map & Insights View

**Status: IMPLEMENTED** (2026-03-26/27)

## Context

The Insights tab is overloaded — 30+ dense station cards with scores, 12 signals, AI analysis, and expandable dossiers. The Maps tab is purely navigational with rich data layers but no proactive insights. Users switch between tabs to correlate spatial and analytical data, losing context each time.

**Goal:** Add a new "Map & Insights" tab that combines the full interactive map with an Intelligence Panel, providing progressive disclosure from executive overview to deep-dive analysis — all in one screen.

**Constraint:** Add as a new tab alongside existing ones (no removal) for safe rollback.

## Multi-Anchor Extension (2026-03-27)

Extended from station-only to three anchor types with unified scoring:
- **Stations** (517) — 7-signal model (existing)
- **Junctions** (5,000) — 4-signal drive-thru model, diamond markers tied to traffic layer
- **MSOA Zones** (~1,100+) — 4-signal area model, cyan circle + pin on selection

All three produce 0-100 scores merged into one ranked list. Anchor type filter chips (All/Stations/Junctions/Zones) + tier filter + sort.

## Layout

**Tab structure:** Header gains a new tab "Map & Insights". Existing Insights, Map, Table, Radar tabs remain unchanged. The default view (`readViewFromHash()` fallback) stays "opportunities" for now — the new tab becomes default only after validation.

**Three-column layout:**
- **Sidebar** (240px) — existing sidebar (brands, layers, display mode). Unchanged.
- **Map** (flex: 3, ~60%) — full interactive map with all current layers + new insight overlays.
- **Intelligence Panel** (flex: 2, ~40%, min 360px, max 440px) — contextual analytics panel.

## Map Enhancements

### KPI Strip
A thin bar across the top of the map area showing contextual summary metrics:
- Act Now count (green), Evaluate count (yellow), Monitor count (gray)
- Average opportunity score (blue)
- Context label: selected brands + station count

Recomputes when brands or filters change. Uses data from `useOpportunities` hook.

### Numbered Opportunity Markers
All scored stations get markers; the top 10 at current zoom level show rank numbers:
- **Color** = action tier (green: Act Now 80+, yellow: Evaluate 60-79, gray: Monitor <60)
- **Size** = relative score (larger = higher score)
- **Number** = rank position (#1, #2, #3...)
- **Hover** = tooltip with station name, score, key metrics (pax/yr, gaps, bus stops)
- **Click** = map centers on station, Intelligence Panel switches to deep dive

These are a visual mode of the existing station analysis layer. When the Smart Map view is active, the station analysis layer renders numbered/colored markers instead of the default size+color circles. The underlying data is the same `oppByStation` Map — only the rendering changes.

### Opportunity Zone Overlay
New toggleable layer in sidebar under "Insight Layers":
- Soft radial gradient areas highlighting clusters of high-scoring stations
- Generated client-side: group stations within 20km radius, draw `L.circle` with gradient fill around cluster centroid
- Light green/yellow tint at 0.08 opacity — non-blocking, underlying layers remain visible
- Only rendered when 2+ Act Now/Evaluate stations cluster together

## Intelligence Panel

### Three States

**1. Overview (default)**
- **Executive Brief** — 2-3 sentence narrative summary. Reuses `narrative` from `useOpportunities`.
- **Top Opportunities list** — scrollable station cards, sorted by score descending.
  - Each card shows: score badge, name, rank, region, tier, confidence, key metrics (pax/yr, gaps, bus stops), and a one-line AI insight.
  - Clicking a card → transitions to Deep Dive state + map centers on station.
  - Hover on a card → corresponding map marker highlights (pulse effect).
- **"Show all N opportunities"** link at bottom → scrolls to reveal full list.
- **Footer** — "Last updated" timestamp + "Export CSV" link.

**2. Station Deep Dive (after clicking a station)**
- **Back button** — "← Back to overview" returns to Overview state.
- **Station header** — large score badge, station name, location, tier badge with confidence.
- **Metrics grid** (2×2) — footfall, bus stops, nearby QSR count, road traffic.
- **Signal strength** — 7 signal bars with percentages (footfall, brand gap, demographic, density, pedestrian, road traffic, workforce). Reuses scoring data from `opportunity-scoring.ts`.
- **Brands within 800m** — present brands with counts + GAP badges for missing brands.
- **AI Recommendation** — purple-tinted box with strategic analysis text. Reuses existing insight generation from `useLocationContext`.
- **Demand Evidence** — cited facts with source badges (GOV/GP/CROSS).
- **Risks & Caveats** — risk factors with citations.

All of this data already exists in `StationAnalysisPanel` and `StationCard` components — it's a re-layout, not new computation.

**3. Zone Deep Dive (after clicking an MSOA polygon)**
- Same as current `ContextPanel` behavior but rendered inside the Intelligence Panel:
  - MSOA name, deprivation label/decile
  - Nearby brands within 1km
  - Nearest station with opportunity score
  - Contextual insight

### Map-Panel Synchronization
- **Card hover → map**: marker gets a pulse/highlight animation
- **Card click → map**: map flies to station, shows 800m radius circle, nearby brands visible, other markers fade
- **Map marker click → panel**: panel switches to Deep Dive for that station
- **Map polygon click → panel**: panel switches to Zone Deep Dive
- **Back button → map**: map returns to previous zoom/center, removes radius circle

## Brand Focus Mode

When exactly one brand is selected, the entire view adapts to answer: **"Where should this brand open next?"**

### Intelligence Panel — Brand Focus
- **Executive Brief** becomes brand-specific: "12 locations for **KFC** expansion..." (uses `brandIntelligence` from `useOpportunities`)
- **Affinity badge** at top: "Income affinity: deciles 4-8 • Match rate: 73%"
- **Filter bar** below brief with quick filters:
  - **Region** dropdown (all regions / specific region)
  - **Tier** chips: Act Now | Evaluate | Monitor (toggleable)
  - **Sort by**: Score (default) | Footfall | Brand gaps | Distance from nearest existing
- **Card AI insights** become brand-specific: "Zero KFC within 800m, but McDonald's and Subway validate demand"
- **"Distance from nearest existing"** column added to cards — shows how far the opportunity is from the nearest existing location of the selected brand. Helps identify white spots vs. cannibalization risk.

### Map — Brand Focus
- Existing locations of the selected brand get a distinct marker (brand color, filled circle) — "you are here" anchors
- Opportunity markers show **brand gap count** as a secondary label (e.g., "91 • 3 gaps")
- When "Opportunity zones" layer is on, zones are colored by brand-specific score, not generic score

### Multi-brand Selection
When 2+ brands are selected, Brand Focus Mode is off. The view shows generic cross-brand opportunities. A subtle hint appears: "Select a single brand for focused recommendations."

## Components to Create

| Component | Path | Responsibility |
|-----------|------|----------------|
| `SmartMapView` | `src/components/explorer/SmartMapView.tsx` | Layout orchestrator: sidebar + map + panel |
| `IntelligencePanel` | `src/components/explorer/intelligence/IntelligencePanel.tsx` | Panel state machine (overview / station / zone) |
| `OverviewState` | `src/components/explorer/intelligence/OverviewState.tsx` | Executive brief + opportunity card list |
| `StationDeepDive` | `src/components/explorer/intelligence/StationDeepDive.tsx` | Full station analysis (refactored from StationCard + StationAnalysisPanel) |
| `ZoneDeepDive` | `src/components/explorer/intelligence/ZoneDeepDive.tsx` | MSOA zone analysis (refactored from ContextPanel) |
| `OpportunityCard` | `src/components/explorer/intelligence/OpportunityCard.tsx` | Compact station card for overview list |
| `KpiStrip` | `src/components/explorer/intelligence/KpiStrip.tsx` | Map overlay with summary metrics |

## Reused Existing Code

| What | Where | How |
|------|-------|-----|
| Opportunity scoring & signals | `src/lib/opportunity-scoring.ts` | Direct reuse — same 7-signal model |
| Opportunities data & KPIs | `src/hooks/useOpportunities.ts` | Hook provides stations, kpis, narrative |
| Location context (nearby brands, station) | `src/hooks/useLocationContext.ts` | Used for zone deep dive |
| Geo utilities (distance, nearest) | `src/lib/geo-utils.ts` | Haversine, radius counting |
| Map layers (all existing) | `src/hooks/map-layers/*` | Unchanged, mounted in SmartMapView |
| MapView rendering | `src/components/explorer/MapView.tsx` | Reuse map setup, add numbered markers layer |
| Sidebar | `src/components/explorer/Sidebar` | Unchanged, passed through |
| Station analysis data | `StationCard.tsx`, `StationAnalysisPanel.tsx` | Extract rendering logic, reuse in StationDeepDive |
| Context panel data | `ContextPanel.tsx` | Extract rendering logic, reuse in ZoneDeepDive |

## State Management

The `SmartMapView` manages panel state:

```typescript
type PanelState =
  | { mode: 'overview' }
  | { mode: 'station'; stationName: string }
  | { mode: 'zone'; lat: number; lng: number; msoaName: string }
```

- Stored in `useState` within `SmartMapView` — no global state needed.
- Panel state transitions triggered by: card clicks, map marker clicks, map polygon clicks, back button.
- Map position synced via existing `onMapPositionChange` pattern.

## What Stays Unchanged

- **Existing Map tab** — untouched, fully functional
- **Existing Insights tab** — untouched, still accessible
- **Table tab** — untouched
- **Radar tab** — untouched
- **All data layers** — same hooks, same rendering
- **Sidebar** — same component, shared between Map and Smart Map tabs
- **Agent system** — agents still accessible via Agents sub-tab in Intelligence Panel

## Verification

1. **Layout renders correctly** — Sidebar + Map + Intelligence Panel visible at standard viewport (1440px+)
2. **Overview state** — Executive brief shows correct narrative, opportunity cards list matches Insights tab rankings
3. **Map markers** — Top-N stations show numbered, colored markers; hover shows tooltip; click opens deep dive
4. **Deep dive** — All 7 signals, metrics, brands, AI insight, evidence render correctly; data matches existing StationCard
5. **Map-panel sync** — Card hover highlights marker; card click flies to station; map click opens deep dive
6. **Back navigation** — "← Back to overview" returns to list, map zooms back
7. **Zone click** — Clicking MSOA polygon shows zone deep dive with nearby brands + nearest station
8. **Existing tabs** — Map, Insights, Table, Radar all still work independently
9. **KPI strip** — Updates when brands change; counts match Insights tab KPIs
10. **Responsive** — Panel doesn't overflow at min-width 360px; map remains usable at 60%
