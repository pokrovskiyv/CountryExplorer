# Per-Station Local Income Decile

**Date:** 2026-03-25
**Status:** Approved
**Author:** Vitaly + Claude

## Problem

The scoring engine looks up `medianIncomeDecile` from `REGION_DEMOGRAPHICS` — one value per region. All London stations get decile 3 (one of the lowest in UK), even though stations in Kensington and Canary Wharf are surrounded by wealthy LSOAs. This makes the demographic signal useless for premium brands in London and masks intra-region variation everywhere.

## Solution

Compute `localIncomeDecile` per station — the median UK-wide income decile of all micro-areas (LSOA / Data Zone / SOA) within 1.5km. Store it on each station record. The scoring engine reads station-level data first, falling back to region-level only when no nearby micro-areas exist.

## Data Sources

New centroid files needed (all OGL v3.0):

| File | Source | Records | Coverage |
|------|--------|---------|----------|
| `lsoa-centroids.csv` | ONS Open Geography Portal (2021 boundaries) | ~33,755 + ~1,917 Welsh | England + Wales |
| `datazone-centroids.csv` | statistics.gov.scot | ~6,976 | Scotland |
| `soa-centroids.csv` | NISRA / OpenDataNI | ~890 | Northern Ireland |

Income deprivation rates come from the same 4 sources already used by `convert-demographics.py` (IMD 2025, WIMD 2025, SIMD 2020v2, NIMDM 2017).

## Architecture

### 1. Download script (`scripts/download-external-data.sh`)

Add 3 new centroid downloads to the existing script.

### 2. New script: `scripts/convert-local-income.py`

Follows the same pattern as `convert-workplace-pop.py`:

**Step 1 — Load centroid coordinates:**
Read all 3 centroid CSVs → dict of `{code: (lat, lon)}` for ~43K micro-areas.

**Step 2 — Load income deprivation rates:**
Read income rates from the same 4 source files used by `convert-demographics.py`:
- IMD 2025 CSV → LSOA code → Income Score (rate)
- WIMD 2025 ODS → LSOA code → Income score
- SIMD 2020v2 indicators XLSX → Data Zone → income_rate
- NIMDM 2017 XLS → SOA → income proportion

Result: dict of `{code: income_rate}` for ~43K micro-areas.

**Step 3 — Compute UK-wide deciles:**
Same algorithm as `convert-demographics.py`:
1. Collect all income rates into one array
2. Sort ascending (least deprived first)
3. Assign percentile: `i / (n - 1)`
4. Convert to decile: `10 - floor(percentile * 10)` (1 = most deprived, 10 = least)

Result: dict of `{code: uk_decile}` for ~43K micro-areas.

**Step 4 — Spatial join:**
For each station in `station-data.ts`:
1. Find all micro-areas within 1.5km radius (haversine distance)
2. Collect their UK-wide deciles
3. Take the median → `localIncomeDecile`
4. If no micro-areas within 1.5km → `localIncomeDecile: 0` (no data)

**Step 5 — Enrich station-data.ts:**
Add `localIncomeDecile` field to each station record via regex-based rewriting (same approach as `convert-workplace-pop.py`).

### 3. Station data (`src/data/station-data.ts`)

New field on `StationRecord`:

```typescript
readonly localIncomeDecile: number  // 0 = no data, 1-10 = UK-wide normalized
```

### 4. Scoring engine (`src/lib/opportunity-scoring.ts`)

Change `evaluateDemographic` function. Current priority chain:

1. Business district (50K+ workers) → worker salary → return
2. Region lookup in REGION_DEMOGRAPHICS → medianIncomeDecile → return
3. No demo found → strength: 0, fired: false

New priority chain:

1. Business district (50K+ workers) → worker salary → return (unchanged)
2. **Station-level**: if `station.localIncomeDecile > 0` → use it, source: `"Local income (1.5km)"`
3. **Fallback to region**: REGION_DEMOGRAPHICS lookup → `medianIncomeDecile`, source: `demo.deprivationSource`
4. No demo found → strength: 0, fired: false

The brand-affinity thresholds remain identical (`>= 6` premium, `<= 5` value, `>= 3` neutral).

## What does NOT change

- `demographic-data.ts` — still 12 regions for map visualization
- Map layers (Income level / Deprivation index) — region-level coloring unchanged
- Worker salary correction — still takes priority for business districts
- `convert-demographics.py` — unchanged, still generates region-level data
- Opportunity scoring formula — weights, thresholds, other 6 signals unchanged

## Testing

- **Unit:** station with `localIncomeDecile: 7` + premium brand → `fired: true`
- **Unit:** station with `localIncomeDecile: 0` → fallback to region-level decile
- **Unit:** business station (50K+ workers) → worker salary still takes priority
- **Smoke:** all stations have `localIncomeDecile` in range 0-10
- **Validation:** Liverpool Street `localIncomeDecile` should be ~7-8 (City of London), not 3 (all of London)

## Expected impact

| Station | Region decile (before) | Local decile (after) | Effect |
|---------|----------------------|---------------------|--------|
| Liverpool Street | 3 (London) | ~7-8 (City LSOAs) | Premium brands now fire |
| Brixton | 3 (London) | ~2-3 (Lambeth LSOAs) | Stays low — correct |
| Edinburgh Waverley | 8 (Scotland) | ~5-6 (central Edinburgh) | More accurate for value brands |
| Rural station | varies | 0 (no nearby LSOAs) | Falls back to region |
