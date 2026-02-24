

## Plan: Convert HTML prototypes to React components

You have two HTML files in `docs/` that need to be converted into the React app:

1. **Landing page** (`docs/05-landing-page.html`) -- marketing page with nav, hero, screenshot mock, stats, features grid, use cases, and CTA
2. **App prototype** (`docs/prototype.html`) -- interactive Country Explorer with Leaflet map, sidebar with brand toggles, metric selectors, region detail panel, table view, and embedded UK region/brand data

### What will be built

**Routing structure:**
- `/` -- Landing page (converted from `05-landing-page.html`)
- `/explorer` -- Country Explorer app (converted from `prototype.html`)

**Landing page components:**
- `src/pages/LandingPage.tsx` -- main landing page
- `src/components/landing/Navbar.tsx` -- fixed nav with logo + CTA
- `src/components/landing/Hero.tsx` -- hero section with badge, heading, CTAs
- `src/components/landing/Screenshot.tsx` -- mock app screenshot with SVG
- `src/components/landing/StatsBar.tsx` -- 4 stat cards
- `src/components/landing/Features.tsx` -- 6 feature cards grid
- `src/components/landing/UseCases.tsx` -- 3 alternating use case sections with SVG visuals
- `src/components/landing/CTASection.tsx` -- bottom CTA
- `src/components/landing/Footer.tsx` -- footer

**Explorer app components:**
- `src/pages/Explorer.tsx` -- main app layout
- `src/components/explorer/Header.tsx` -- app header with logo, Map/Table tabs, country selector
- `src/components/explorer/Sidebar.tsx` -- brand toggles, metric selector, display mode, country summary
- `src/components/explorer/MapView.tsx` -- Leaflet choropleth map with tooltips and legend
- `src/components/explorer/RegionPanel.tsx` -- right panel with region stats, brand bars, doughnut chart
- `src/components/explorer/TableView.tsx` -- sortable data table
- `src/data/uk-data.ts` -- extracted brand data, region counts, population, TopoJSON, and brand point coordinates

**Dependencies to add:**
- `leaflet` + `@types/leaflet` -- for the interactive map
- `topojson-client` + `@types/topojson-client` -- for TopoJSON parsing (region boundaries are embedded in the prototype)

**Styling approach:**
- All CSS converted to Tailwind utility classes where possible
- Custom styles in `src/index.css` for Leaflet overrides and the dark theme specifics that don't map cleanly to Tailwind

**Data handling:**
- All data (brand colors, region counts, population, TopoJSON geometry, sample point coordinates) extracted from the prototype's inline JS into a typed TypeScript module
- Recharts used for the doughnut chart in the region panel (already installed) instead of Chart.js

### Technical notes

- The prototype contains a large embedded TopoJSON dataset (~900K characters on a single line) with UK region boundaries. This will be extracted into a separate data file.
- The Leaflet map will be wrapped in a React component with proper lifecycle management (cleanup on unmount).
- Brand toggles, metric selection, and display mode will use React state.
- The landing page "Get Early Access" and "Request a Demo" buttons will link to `mailto:hello@getplace.io` as in the original.
- The "See How It Works" button will scroll to features section.
- Navigation between landing page and explorer via React Router links.

