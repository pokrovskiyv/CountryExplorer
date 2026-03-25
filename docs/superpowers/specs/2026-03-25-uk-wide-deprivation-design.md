# UK-Wide Deprivation Index Integration

**Date:** 2026-03-25
**Status:** Approved
**Author:** Vitaly + Claude

## Problem

The demographic layer covers only 9 English regions (IMD 2025). Wales, Scotland, and Northern Ireland appear as blank white areas on the map. The scoring engine returns `fired: false` for stations in those regions, losing demographic signal entirely.

## Solution: Combo A+C

Two normalization strategies serving two different consumers:

- **Variant C (scoring):** UK-wide income deprivation rate normalization for cross-nation comparable deciles used in brand-income affinity scoring
- **Variant A (map):** Nation-specific composite deprivation scores normalized to 0-100 for the visual map layer

## Data Sources

| Nation | Index | Version | Units | Format | Key fields |
|--------|-------|---------|-------|--------|------------|
| England | IMD | 2025 | 33,755 LSOA | CSV | Income Score (rate), Employment Score (rate), IMD Score, Income Decile |
| Wales | WIMD | 2025 | 1,917 LSOA | ODS | Income score, Employment score, WIMD score |
| Scotland | SIMD | 2020v2 | 6,976 Data Zones | XLSX | income_rate, employment_rate (indicators file); SIMD rank, decile (ranks file) |
| N. Ireland | NIMDM | 2017 | 890 SOA | XLS | Income proportion, Employment proportion, MDM rank |

All datasets are published under OGL v3.0.

Total: ~43,538 micro-areas across the UK.

## Architecture

### 1. Download script (`scripts/download-external-data.sh`)

Add three new downloads alongside existing `imd-2025-file7.csv`:
- WIMD 2025 scores ODS from gov.wales
- SIMD 2020v2 indicators XLSX from gov.scot
- NIMDM 2017 SOA results XLS from nisra.gov.uk

### 2. Converter (`scripts/convert-demographics.py`)

Extend to handle all 4 nations in 4 steps:

**Step 1 — Load all 4 sources:**
Each loader extracts: income_rate, employment_rate, composite_score_or_rank, and maps each micro-area to one of 12 UK regions.

Region mapping:
- England: existing `la_to_region()` function (9 regions)
- Wales: all LSOAs map to "Wales"
- Scotland: all Data Zones map to "Scotland"
- Northern Ireland: all SOAs map to "Northern Ireland"

**Step 2 — UK-wide income normalization (Variant C, for scoring):**
1. Collect income deprivation rates from all ~43,500 micro-areas into one array
2. Sort and compute percentile for each micro-area
3. Convert percentile to decile (1-10, where 1 = most deprived)
4. Aggregate to 12 regions: median UK-normalized income decile

**Step 3 — Nation-specific composite normalization (Variant A, for map):**
- IMD (England): `avgImdScore` used directly (already 0-100 range effectively, though typically 14-30 at region level)
- WIMD (Wales): `avgWimdScore` used directly (0-100 scale, where 100 = most deprived)
- SIMD (Scotland): rank 1 = most deprived, rank 6976 = least deprived. Normalize to 0-100 via `(6976 - rank) / 6976 * 100`, so most deprived → ~100, least deprived → ~0
- NIMDM (N. Ireland): rank 1 = most deprived, rank 890 = least deprived. Normalize via `(890 - rank) / 890 * 100`

All four scales: 0-100 where higher = more deprived.

**Build-time assertions:** The converter validates that all output `avgImdScore` values fall in 0-100 and all `medianIncomeDecile` values fall in 1-10.

**Step 4 — Generate `demographic-data.ts`:**
Output: 12 region records (9 England + Wales + Scotland + Northern Ireland).

**New Python dependency:** `pandas` — reads CSV, XLSX, XLS, and ODS formats. Used only at build time; does not affect frontend bundle.

### 3. Data interface (`src/data/demographic-data.ts`)

```typescript
export interface RegionDemographics {
  readonly region: string
  readonly avgIncomeScore: number        // income deprivation rate (nation-specific, NOT cross-nation comparable)
  readonly avgEmploymentScore: number    // employment deprivation rate (nation-specific, NOT cross-nation comparable)
  readonly medianIncomeDecile: number    // UK-wide normalized decile (Variant C) — the ONLY cross-nation comparable field
  readonly avgImdScore: number           // nation-normalized 0-100 composite (Variant A, for map only)
  readonly lsoaCount: number             // micro-areas count (LSOA / DZ / SOA)
  readonly deprivationSource: string     // "IMD 2025" | "WIMD 2025" | "SIMD 2020" | "NIMDM 2017"
  readonly microAreaLabel: string        // "LSOAs" | "Data Zones" | "SOAs" — for tooltips
}
```

New fields: `deprivationSource`, `microAreaLabel`. Existing field `medianIncomeDecile` changes meaning from nation-specific to UK-wide normalized. Values for 9 English regions may shift slightly — after running normalization against actual data, validate that brand-affinity thresholds (`>= 6` premium, `<= 5` value) remain stable. If English deciles shift by more than 1, recalibrate thresholds.

**Cross-nation field usage rules:**
- `medianIncomeDecile` — cross-nation comparable, safe for scoring and cross-region comparison
- `avgIncomeScore`, `avgEmploymentScore` — nation-specific rates, use for intra-nation display only. Methodological differences across nations make direct comparison misleading (different poverty baselines, different indicators)
- `avgImdScore` — nation-normalized composite, use for map coloring only

### 4. Scoring engine (`src/lib/opportunity-scoring.ts`)

Minimal change in `evaluateDemographic`:
- All 12 regions now found in `REGION_DEMOGRAPHICS` — the `strength: 0` fallback fires only for unknown regions
- `medianIncomeDecile` is UK-normalized — brand-affinity thresholds (`>= 6` for premium, `<= 5` for value) work correctly cross-nation
- `source` field reads from `demo.deprivationSource` instead of hardcoded `"IMD 2025"` (both the found and not-found code paths — line 283 fallback uses `"No data"`)
- `generateNarrative` sources array: replace hardcoded `"IMD 2025"` with `"UK Deprivation Indices"`

### 5. Map visualization (`src/components/explorer/MapView.tsx`)

**`imdColor` function:**
Current hardcoded range `(score - 14) / 16` will break for non-England regions (e.g., Wales composite score ~45 would clamp to max red). Fix: compute min/max at render time from `REGION_DEMOGRAPHICS` array:
```typescript
const scores = REGION_DEMOGRAPHICS.map(d => d.avgImdScore)
const min = Math.min(...scores)
const max = Math.max(...scores)
const t = (score - min) / (max - min)
```
This adapts automatically as data changes.

**Tooltip:**
- Add deprivation source: "Deprivation: 24.5 (IMD 2025)" / "Deprivation: 31.2 (WIMD 2025)"
- Use `microAreaLabel` instead of hardcoded "LSOAs": `${demo.lsoaCount} ${demo.microAreaLabel}`

**Income layer:**
No changes needed — `medianIncomeDecile` is still 1-10, `INCOME_COLORS[idx]` works as before.

**Legend:**
Stays as-is (gradient Low to High). Optional footnote about cross-nation normalization.

## Additional files to update

- `src/components/explorer/opportunities/ExecutiveBrief.tsx` — `SOURCE_RIBBON` hardcodes "IMD 2025" and "33,755 LSOAs". Update to reflect 4 sources and ~43,538 micro-areas
- `src/data/ai-opportunity-analysis.ts` — static text mentions "IMD data is unavailable for Scotland/Wales". Remove or update these disclaimers
- `src/lib/opportunity-scoring.ts` — `generateNarrative` sources array hardcodes "IMD 2025"
- Generated file header comment in converter — update from "IMD 2025" to "UK Deprivation Indices"

## What does NOT change

- GeoJSON region boundaries — Wales, Scotland, Northern Ireland regions already exist in the ITL1 GeoJSON
- Station data pipeline — stations already have `region` field
- Opportunity scoring formula — weights, thresholds, other signals untouched
- Landing page, radar, dossier — no changes

## Testing

- **Unit test:** UK-wide normalization distributes income rates into correct deciles
- **Unit test:** all 12 regions present in `REGION_DEMOGRAPHICS`
- **Unit test:** `evaluateDemographic` returns `fired: true` for Welsh/Scottish/NI stations
- **Smoke test:** `avgImdScore` in range 0-100 for all regions
- **Visual:** Wales, Scotland, Northern Ireland no longer white on the map

## Known limitations

- NIMDM 2017 data is from 2015/16 — significantly older than other sources
- SIMD 2020v2 is pre-Census 2021 — next update expected late 2026
- Nation-specific composite scores (Variant A) are NOT directly comparable across nations — this is by design, they are used only for intra-nation map coloring
- Cross-nation comparability relies solely on income deprivation rate (Variant C) — a deliberate simplification that works for our brand-affinity use case
