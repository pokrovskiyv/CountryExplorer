# UK-Wide Deprivation Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Wales (WIMD 2025), Scotland (SIMD 2020v2), and Northern Ireland (NIMDM 2017) deprivation data so all 12 UK regions have demographic scoring and map coloring.

**Architecture:** Combo A+C — UK-wide income rate normalization for scoring (Variant C) + nation-specific composite deprivation for the map (Variant A). The converter script loads 4 data sources, normalizes, and outputs 12 regions to `demographic-data.ts`. Scoring engine and map consume the expanded data.

**Tech Stack:** Python (pandas), TypeScript, React, Leaflet, Vitest

**Spec:** `docs/superpowers/specs/2026-03-25-uk-wide-deprivation-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `scripts/download-external-data.sh` | Add 3 new data downloads |
| Modify | `scripts/convert-demographics.py` | 4-nation loading, UK-wide normalization, expanded output |
| Modify | `src/data/demographic-data.ts` | Generated — 12 regions with new fields |
| Modify | `src/lib/opportunity-scoring.ts` | Use `deprivationSource`, fix narrative sources |
| Modify | `src/components/explorer/MapView.tsx` | Dynamic `imdColor`, updated tooltips |
| Modify | `src/components/explorer/opportunities/ExecutiveBrief.tsx` | Update SOURCE_RIBBON |
| Modify | `src/data/ai-opportunity-analysis.ts` | Remove stale "data unavailable" disclaimers |
| Create | `src/test/demographic-normalization.test.ts` | Unit tests for the new data and scoring integration |

---

### Task 1: Download script — add 3 new data sources

**Files:**
- Modify: `scripts/download-external-data.sh`

- [ ] **Step 1: Add WIMD 2025 download**

After the IMD 2025 section (line 70), add:

```bash
# 5. WIMD 2025 (Welsh Index of Multiple Deprivation)
echo ""
echo "[5/8] WIMD 2025..."
if [ ! -f "wimd-2025-scores.ods" ]; then
  curl -L -o "wimd-2025-scores.ods" \
    "https://www.gov.wales/sites/default/files/statistics-and-research/2025-11/wimd-2025-index-and-domain-scores-by-small-area.ods"
  echo "  Downloaded wimd-2025-scores.ods"
else
  echo "  Already exists, skipping"
fi
```

- [ ] **Step 2: Add SIMD 2020v2 download**

```bash
# 6. SIMD 2020v2 (Scottish Index of Multiple Deprivation)
echo ""
echo "[6/8] SIMD 2020v2..."
if [ ! -f "simd-2020v2-indicators.xlsx" ]; then
  curl -L -o "simd-2020v2-indicators.xlsx" \
    "https://www.gov.scot/binaries/content/documents/govscot/publications/statistics/2020/01/scottish-index-of-multiple-deprivation-2020-indicator-data/documents/simd_2020_indicators/simd_2020_indicators/govscot%3Adocument/SIMD%2B2020v2%2B-%2Bindicators.xlsx"
  echo "  Downloaded simd-2020v2-indicators.xlsx"
else
  echo "  Already exists, skipping"
fi

if [ ! -f "simd-2020v2-ranks.xlsx" ]; then
  curl -L -o "simd-2020v2-ranks.xlsx" \
    "https://www.gov.scot/binaries/content/documents/govscot/publications/statistics/2020/01/scottish-index-of-multiple-deprivation-2020-ranks-and-domain-ranks/documents/scottish-index-of-multiple-deprivation-2020-ranks-and-domain-ranks/scottish-index-of-multiple-deprivation-2020-ranks-and-domain-ranks/govscot%3Adocument/SIMD%2B2020v2%2B-%2Branks.xlsx"
  echo "  Downloaded simd-2020v2-ranks.xlsx"
else
  echo "  Already exists, skipping"
fi
```

- [ ] **Step 3: Add NIMDM 2017 download**

```bash
# 7. NIMDM 2017 (Northern Ireland Multiple Deprivation Measure)
echo ""
echo "[7/8] NIMDM 2017..."
if [ ! -f "nimdm17-soa-results.xls" ]; then
  curl -L -o "nimdm17-soa-results.xls" \
    "https://www.nisra.gov.uk/files/nisra/publications/NIMDM17_SOAresults.xls"
  echo "  Downloaded nimdm17-soa-results.xls"
else
  echo "  Already exists, skipping"
fi
```

- [ ] **Step 4: Update counter labels**

Change `[1/5]` through `[5/5]` to `[1/8]` through `[8/8]`. The Census download becomes `[8/8]`.

- [ ] **Step 5: Run the download script**

```bash
cd /Users/vitalypokrovskiy/Projects/CountryExplorer
bash scripts/download-external-data.sh
```

Expected: 3 new files appear in `src/data/Data for assignment/external/`:
- `wimd-2025-scores.ods`
- `simd-2020v2-indicators.xlsx` + `simd-2020v2-ranks.xlsx`
- `nimdm17-soa-results.xls`

Verify they downloaded successfully. If any URL fails, search for the current download URL on the respective government website and update the script.

- [ ] **Step 6: Commit**

```bash
git add scripts/download-external-data.sh
git commit -m "feat: add WIMD, SIMD, NIMDM download URLs to external data script"
```

---

### Task 2: Converter — load WIMD 2025 (Wales)

**Files:**
- Modify: `scripts/convert-demographics.py`

- [ ] **Step 0: Install Python dependencies**

```bash
pip install pandas openpyxl xlrd odfpy
```

- [ ] **Step 1: Add pandas import and remove csv-only constraint**

At top of file, replace:
```python
import csv
import sys
from pathlib import Path
from collections import defaultdict
```
with:
```python
import sys
from pathlib import Path
from collections import defaultdict
import pandas as pd
```

- [ ] **Step 2: Add MicroArea dataclass for uniform representation**

After the imports, add:
```python
from dataclasses import dataclass

@dataclass
class MicroArea:
    """One LSOA / Data Zone / SOA with fields needed for normalization."""
    region: str
    income_rate: float          # income deprivation rate (nation-specific)
    employment_rate: float      # employment deprivation rate (nation-specific)
    composite_score: float      # nation-normalized 0-100 (higher = more deprived)
    nation: str                 # "england" | "wales" | "scotland" | "ni"
    uk_decile: int = 0          # populated by compute_uk_income_deciles()
```

- [ ] **Step 3: Add `load_wimd()` function**

```python
def load_wimd() -> list[MicroArea]:
    """Load WIMD 2025 scores ODS — 1,917 Welsh LSOAs."""
    wimd_file = EXT_DIR / "wimd-2025-scores.ods"
    if not wimd_file.exists():
        print(f"  WARNING: {wimd_file} not found, skipping Wales")
        return []

    df = pd.read_excel(wimd_file, engine="odf", sheet_name=0)
    # Normalize column names to lowercase for resilient matching
    df.columns = [c.strip().lower() for c in df.columns]
    print(f"  WIMD columns: {list(df.columns[:10])}")

    # Find columns — WIMD 2025 uses "wimd 2025" for overall, "income" for domain
    income_col = next((c for c in df.columns if "income" in c and "score" in c), None)
    employment_col = next((c for c in df.columns if "employment" in c and "score" in c), None)
    overall_col = next((c for c in df.columns if "wimd" in c and "2025" in c and "score" not in c), None)
    if not overall_col:
        overall_col = next((c for c in df.columns if "wimd" in c), None)

    print(f"  Using: income='{income_col}', employment='{employment_col}', overall='{overall_col}'")

    areas = []
    for _, row in df.iterrows():
        try:
            income = float(row[income_col]) if income_col and pd.notna(row.get(income_col)) else 0.0
            employment = float(row[employment_col]) if employment_col and pd.notna(row.get(employment_col)) else 0.0
            # WIMD score is already 0-100 where 100 = most deprived
            composite = float(row[overall_col]) if overall_col and pd.notna(row.get(overall_col)) else 0.0
            # WIMD scores are 0-100 (exponentially transformed). Normalize to 0-1 rate.
            # Assertion: if max value > 1, we're dealing with percentages/scores, not rates.
            income_norm = income / 100 if income > 1 else income
            employment_norm = employment / 100 if employment > 1 else employment
            areas.append(MicroArea(
                region="Wales",
                income_rate=income_norm,
                employment_rate=employment_norm,
                composite_score=composite,
                nation="wales",
            ))
        except (ValueError, TypeError):
            continue

    # Validate: all income_rates should be in [0, 1]
    rates = [a.income_rate for a in areas]
    assert all(0 <= r <= 1 for r in rates), f"WIMD income_rate out of [0,1] range: min={min(rates)}, max={max(rates)}"
    print(f"  Loaded {len(areas)} Welsh LSOAs (income_rate range: {min(rates):.4f}-{max(rates):.4f})")
    return areas
```

- [ ] **Step 4: Run converter to verify WIMD loading**

```bash
cd /Users/vitalypokrovskiy/Projects/CountryExplorer
python3 -c "
import sys; sys.path.insert(0, 'scripts')
from convert_demographics import load_wimd  # may need to adjust import
"
```

If import fails because the script uses dashes in filename, run directly:
```bash
python3 scripts/convert-demographics.py
```

Verify output includes "Loaded XXXX Welsh LSOAs" (expect ~1,917).

- [ ] **Step 5: Commit**

```bash
git add scripts/convert-demographics.py
git commit -m "feat: add WIMD 2025 loader for Welsh deprivation data"
```

---

### Task 3: Converter — load SIMD 2020v2 (Scotland)

**Files:**
- Modify: `scripts/convert-demographics.py`

- [ ] **Step 1: Add `load_simd()` function**

```python
SIMD_TOTAL_DZ = 6976  # total Data Zones in Scotland

def load_simd() -> list[MicroArea]:
    """Load SIMD 2020v2 — 6,976 Scottish Data Zones."""
    indicators_file = EXT_DIR / "simd-2020v2-indicators.xlsx"
    ranks_file = EXT_DIR / "simd-2020v2-ranks.xlsx"

    if not indicators_file.exists() or not ranks_file.exists():
        print(f"  WARNING: SIMD files not found, skipping Scotland")
        return []

    # Indicators file has income_rate and employment_rate
    df_ind = pd.read_excel(indicators_file, sheet_name=0)
    df_ind.columns = [c.strip().lower().replace(" ", "_") for c in df_ind.columns]

    # Ranks file has overall SIMD rank
    df_rank = pd.read_excel(ranks_file, sheet_name=0)
    df_rank.columns = [c.strip().lower().replace(" ", "_") for c in df_rank.columns]

    print(f"  SIMD indicator columns: {list(df_ind.columns[:10])}")
    print(f"  SIMD rank columns: {list(df_rank.columns[:10])}")

    # Find Data Zone column in both
    dz_col_ind = next((c for c in df_ind.columns if "data_zone" in c or "datazone" in c), df_ind.columns[0])
    dz_col_rank = next((c for c in df_rank.columns if "data_zone" in c or "datazone" in c), df_rank.columns[0])

    # Find income/employment rate columns in indicators
    income_col = next((c for c in df_ind.columns if "income_rate" in c), None)
    employment_col = next((c for c in df_ind.columns if "employment_rate" in c), None)

    # Find overall rank column
    rank_col = next((c for c in df_rank.columns if "simd2020" in c and "rank" in c), None)
    if not rank_col:
        rank_col = next((c for c in df_rank.columns if "rank" in c), None)

    print(f"  Using: income='{income_col}', employment='{employment_col}', rank='{rank_col}'")

    # Merge on data zone
    df = df_ind.merge(df_rank[[dz_col_rank, rank_col]], left_on=dz_col_ind, right_on=dz_col_rank, how="left")

    areas = []
    for _, row in df.iterrows():
        try:
            income = float(row[income_col]) if income_col and pd.notna(row.get(income_col)) else 0.0
            employment = float(row[employment_col]) if employment_col and pd.notna(row.get(employment_col)) else 0.0
            rank = int(row[rank_col]) if rank_col and pd.notna(row.get(rank_col)) else SIMD_TOTAL_DZ // 2
            # Rank 1 = most deprived → score ~100; Rank 6976 = least → score ~0
            composite = (SIMD_TOTAL_DZ - rank) / SIMD_TOTAL_DZ * 100
            areas.append(MicroArea(
                region="Scotland",
                income_rate=income,
                employment_rate=employment,
                composite_score=composite,
                nation="scotland",
            ))
        except (ValueError, TypeError):
            continue

    print(f"  Loaded {len(areas)} Scottish Data Zones")
    return areas
```

- [ ] **Step 2: Verify SIMD loading**

```bash
python3 scripts/convert-demographics.py
```

Expect "Loaded ~6,976 Scottish Data Zones".

- [ ] **Step 3: Commit**

```bash
git add scripts/convert-demographics.py
git commit -m "feat: add SIMD 2020v2 loader for Scottish deprivation data"
```

---

### Task 4: Converter — load NIMDM 2017 (Northern Ireland)

**Files:**
- Modify: `scripts/convert-demographics.py`

- [ ] **Step 1: Add `load_nimdm()` function**

```python
NIMDM_TOTAL_SOA = 890  # total Super Output Areas in Northern Ireland

def load_nimdm() -> list[MicroArea]:
    """Load NIMDM 2017 — 890 Northern Ireland SOAs."""
    nimdm_file = EXT_DIR / "nimdm17-soa-results.xls"
    if not nimdm_file.exists():
        print(f"  WARNING: {nimdm_file} not found, skipping Northern Ireland")
        return []

    # MDM sheet has overall ranks; Income sheet has income proportion
    df_mdm = pd.read_excel(nimdm_file, sheet_name="MDM", engine="xlrd")
    df_mdm.columns = [c.strip().lower() for c in df_mdm.columns]
    print(f"  NIMDM MDM columns: {list(df_mdm.columns[:10])}")

    df_income = pd.read_excel(nimdm_file, sheet_name="Income", engine="xlrd")
    df_income.columns = [c.strip().lower() for c in df_income.columns]

    df_employment = pd.read_excel(nimdm_file, sheet_name="Employment", engine="xlrd")
    df_employment.columns = [c.strip().lower() for c in df_employment.columns]

    # Find SOA code columns
    soa_col_mdm = next((c for c in df_mdm.columns if "soa" in c and "name" not in c), df_mdm.columns[2])
    rank_col = next((c for c in df_mdm.columns if "multiple deprivation" in c and "rank" in c), None)
    if not rank_col:
        rank_col = next((c for c in df_mdm.columns if "rank" in c), None)

    soa_col_inc = next((c for c in df_income.columns if "soa" in c and "name" not in c), df_income.columns[2])
    income_prop_col = next((c for c in df_income.columns if "proportion" in c), None)

    soa_col_emp = next((c for c in df_employment.columns if "soa" in c and "name" not in c), df_employment.columns[2])
    employment_prop_col = next((c for c in df_employment.columns if "proportion" in c), None)

    print(f"  Using: rank='{rank_col}', income='{income_prop_col}', employment='{employment_prop_col}'")

    # Merge income and employment onto MDM
    df = df_mdm.copy()
    if income_prop_col:
        df = df.merge(df_income[[soa_col_inc, income_prop_col]].rename(columns={income_prop_col: "_income_rate"}),
                       left_on=soa_col_mdm, right_on=soa_col_inc, how="left")
    if employment_prop_col:
        df = df.merge(df_employment[[soa_col_emp, employment_prop_col]].rename(columns={employment_prop_col: "_empl_rate"}),
                       left_on=soa_col_mdm, right_on=soa_col_emp, how="left")

    areas = []
    for _, row in df.iterrows():
        try:
            income = float(row.get("_income_rate", 0)) if pd.notna(row.get("_income_rate")) else 0.0
            employment = float(row.get("_empl_rate", 0)) if pd.notna(row.get("_empl_rate")) else 0.0
            rank = int(row[rank_col]) if rank_col and pd.notna(row.get(rank_col)) else NIMDM_TOTAL_SOA // 2
            # Rank 1 = most deprived → score ~100
            composite = (NIMDM_TOTAL_SOA - rank) / NIMDM_TOTAL_SOA * 100
            # Income/employment are percentages — normalize to 0-1 rate
            areas.append(MicroArea(
                region="Northern Ireland",
                income_rate=income / 100 if income > 1 else income,
                employment_rate=employment / 100 if employment > 1 else employment,
                composite_score=composite,
                nation="ni",
            ))
        except (ValueError, TypeError):
            continue

    print(f"  Loaded {len(areas)} Northern Ireland SOAs")
    return areas
```

- [ ] **Step 2: Verify NIMDM loading**

```bash
python3 scripts/convert-demographics.py
```

Expect "Loaded ~890 Northern Ireland SOAs".

- [ ] **Step 3: Commit**

```bash
git add scripts/convert-demographics.py
git commit -m "feat: add NIMDM 2017 loader for Northern Ireland deprivation data"
```

---

### Task 5: Converter — refactor IMD loader + UK-wide normalization + generation

**Note:** This task combines the IMD refactor, normalization, and generation into one step to avoid an intermediate broken state where the converter cannot produce valid output.

**Files:**
- Modify: `scripts/convert-demographics.py`

- [ ] **Step 0: Refactor `load_imd_data()` to return `list[MicroArea]`**

Replace the existing `load_imd_data()` function. Keep the existing `la_to_region()` and `find_column()` helpers. The new function should:

1. Read the CSV with pandas instead of csv module: `pd.read_csv(imd_file, encoding="utf-8-sig")`
2. For each row, call `la_to_region(la_name)` to get the region
3. Return a `list[MicroArea]` with `nation="england"`
4. Use the IMD score directly as `composite_score` (it's already in a 0-~90 range)
5. Income and employment rates are already 0-1 fractions

Keep the function name as `load_imd_data()` but change return type.

- [ ] **Step 1: Add UK-wide income normalization function**

```python
def compute_uk_income_deciles(all_areas: list[MicroArea]) -> dict[str, int]:
    """Variant C: normalize income rates across all UK micro-areas into deciles.
    Returns {region: median_uk_decile}."""
    # Sort all micro-areas by income_rate ascending (lower rate = less deprived = higher decile)
    sorted_areas = sorted(all_areas, key=lambda a: a.income_rate)
    n = len(sorted_areas)

    # Assign UK-wide decile to each area (1 = most deprived, 10 = least deprived)
    for i, area in enumerate(sorted_areas):
        # Percentile: 0 = lowest income rate (least deprived), 1 = highest (most deprived)
        percentile = i / max(n - 1, 1)
        # Decile: 1 = most deprived (highest income rate), 10 = least deprived
        area.uk_decile = 10 - min(int(percentile * 10), 9)

    # Aggregate: median decile per region
    from collections import defaultdict
    region_deciles = defaultdict(list)
    for area in sorted_areas:
        region_deciles[area.region].append(area.uk_decile)

    result = {}
    for region, deciles in region_deciles.items():
        deciles.sort()
        result[region] = deciles[len(deciles) // 2]

    return result
```

Note: Uses the `uk_decile` field defined on the MicroArea dataclass.

- [ ] **Step 2: Add region aggregation function**

```python
NATION_META = {
    "england": {"source": "IMD 2025", "label": "LSOAs"},
    "wales": {"source": "WIMD 2025", "label": "LSOAs"},
    "scotland": {"source": "SIMD 2020", "label": "Data Zones"},
    "ni": {"source": "NIMDM 2017", "label": "SOAs"},
}

def aggregate_regions(all_areas: list[MicroArea], uk_deciles: dict[str, int]) -> list[dict]:
    """Aggregate micro-areas to region-level records."""
    from collections import defaultdict
    region_data = defaultdict(lambda: {
        "income_rates": [], "employment_rates": [], "composite_scores": [],
        "count": 0, "nation": None,
    })

    for area in all_areas:
        rd = region_data[area.region]
        rd["income_rates"].append(area.income_rate)
        rd["employment_rates"].append(area.employment_rate)
        rd["composite_scores"].append(area.composite_score)
        rd["count"] += 1
        rd["nation"] = area.nation

    region_order = [
        "North East (England)", "North West (England)", "Yorkshire and The Humber",
        "East Midlands (England)", "West Midlands (England)", "East (England)",
        "London", "South East (England)", "South West (England)",
        "Wales", "Scotland", "Northern Ireland",
    ]

    records = []
    for region in region_order:
        data = region_data.get(region)
        if not data or data["count"] == 0:
            print(f"  WARNING: No data for region '{region}'")
            continue

        meta = NATION_META[data["nation"]]
        avg_income = sum(data["income_rates"]) / len(data["income_rates"])
        avg_employment = sum(data["employment_rates"]) / len(data["employment_rates"])
        avg_composite = sum(data["composite_scores"]) / len(data["composite_scores"])
        median_decile = uk_deciles.get(region, 5)

        records.append({
            "region": region,
            "avgIncomeScore": avg_income,
            "avgEmploymentScore": avg_employment,
            "medianIncomeDecile": median_decile,
            "avgImdScore": avg_composite,
            "lsoaCount": data["count"],
            "deprivationSource": meta["source"],
            "microAreaLabel": meta["label"],
        })

    return records
```

- [ ] **Step 3: Update `generate_demographic_ts` for new interface**

Rewrite to accept the list of record dicts and output the expanded interface:

```python
def generate_demographic_ts(records: list[dict]):
    """Generate demographic-data.ts with expanded interface."""
    lines = [
        "// UK region demographic data from deprivation indices across 4 nations",
        "// Sources: IMD 2025 (England), WIMD 2025 (Wales), SIMD 2020v2 (Scotland), NIMDM 2017 (N. Ireland)",
        "// All data under Open Government Licence v3.0",
        "// Generated by scripts/convert-demographics.py",
        "",
        "export interface RegionDemographics {",
        "  readonly region: string",
        "  readonly avgIncomeScore: number",
        "  readonly avgEmploymentScore: number",
        "  readonly medianIncomeDecile: number",
        "  readonly avgImdScore: number",
        "  readonly lsoaCount: number",
        "  readonly deprivationSource: string",
        "  readonly microAreaLabel: string",
        "}",
        "",
        "export const REGION_DEMOGRAPHICS: readonly RegionDemographics[] = [",
    ]

    for r in records:
        # Build-time assertions
        assert 0 <= r["avgImdScore"] <= 100, f"avgImdScore out of range for {r['region']}: {r['avgImdScore']}"
        assert 1 <= r["medianIncomeDecile"] <= 10, f"medianIncomeDecile out of range for {r['region']}: {r['medianIncomeDecile']}"

        lines.append(
            f"  {{ region: '{r['region']}', "
            f"avgIncomeScore: {r['avgIncomeScore']:.4f}, "
            f"avgEmploymentScore: {r['avgEmploymentScore']:.4f}, "
            f"medianIncomeDecile: {r['medianIncomeDecile']}, "
            f"avgImdScore: {r['avgImdScore']:.2f}, "
            f"lsoaCount: {r['lsoaCount']}, "
            f"deprivationSource: '{r['deprivationSource']}', "
            f"microAreaLabel: '{r['microAreaLabel']}' }},"
        )

    lines.append("] as const")
    lines.append("")

    out_path = OUT_DIR / "demographic-data.ts"
    with open(out_path, "w") as f:
        f.write("\n".join(lines))
    print(f"\nWritten {out_path}")
```

- [ ] **Step 4: Update `main()` to orchestrate all 4 loaders**

```python
def main():
    print("Loading deprivation data from 4 nations...")

    print("\n[England] IMD 2025...")
    england = load_imd_data()
    print(f"  Total: {len(england)} LSOAs")

    print("\n[Wales] WIMD 2025...")
    wales = load_wimd()

    print("\n[Scotland] SIMD 2020v2...")
    scotland = load_simd()

    print("\n[Northern Ireland] NIMDM 2017...")
    ni = load_nimdm()

    all_areas = england + wales + scotland + ni
    print(f"\nTotal micro-areas: {len(all_areas)}")

    print("\nComputing UK-wide income deciles (Variant C)...")
    uk_deciles = compute_uk_income_deciles(all_areas)
    for region, decile in sorted(uk_deciles.items()):
        print(f"  {region}: decile {decile}")

    print("\nAggregating to 12 regions...")
    records = aggregate_regions(all_areas, uk_deciles)

    generate_demographic_ts(records)
    print("Done!")
```

- [ ] **Step 5: Run the full converter**

```bash
python3 scripts/convert-demographics.py
```

Expected output:
- 12 regions in the output
- All `avgImdScore` between 0 and 100
- All `medianIncomeDecile` between 1 and 10
- Wales, Scotland, Northern Ireland present

- [ ] **Step 6: Inspect generated `demographic-data.ts`**

```bash
cat src/data/demographic-data.ts
```

Verify:
- 12 region entries (was 9)
- New fields `deprivationSource` and `microAreaLabel` present
- English region values similar to before (small shifts acceptable)

- [ ] **Step 7: Validate threshold stability**

Compare old vs new `medianIncomeDecile` for English regions. If any shifted by more than 1, note it — thresholds in scoring may need recalibration.

Old values: NE=4, NW=5, Y&H=5, EM=6, WM=5, East=6, London=4, SE=7, SW=6

- [ ] **Step 8: Commit**

```bash
git add scripts/convert-demographics.py src/data/demographic-data.ts
git commit -m "feat: generate 12-region demographic data with UK-wide income normalization"
```

---

### Task 6: Scoring engine — use deprivationSource

**Files:**
- Modify: `src/lib/opportunity-scoring.ts:278-310` (evaluateDemographic)
- Modify: `src/lib/opportunity-scoring.ts:716` (generateNarrative)

- [ ] **Step 1: Write failing test for Welsh station demographic scoring**

Create `src/test/demographic-normalization.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { REGION_DEMOGRAPHICS } from "@/data/demographic-data"
import { computeStationOpportunities } from "@/lib/opportunity-scoring"

describe("UK-wide demographic data", () => {
  it("has all 12 UK regions", () => {
    const regions = REGION_DEMOGRAPHICS.map(d => d.region)
    expect(regions).toContain("Wales")
    expect(regions).toContain("Scotland")
    expect(regions).toContain("Northern Ireland")
    expect(regions.length).toBe(12)
  })

  it("has avgImdScore in 0-100 range for all regions", () => {
    for (const d of REGION_DEMOGRAPHICS) {
      expect(d.avgImdScore).toBeGreaterThanOrEqual(0)
      expect(d.avgImdScore).toBeLessThanOrEqual(100)
    }
  })

  it("has medianIncomeDecile in 1-10 range for all regions", () => {
    for (const d of REGION_DEMOGRAPHICS) {
      expect(d.medianIncomeDecile).toBeGreaterThanOrEqual(1)
      expect(d.medianIncomeDecile).toBeLessThanOrEqual(10)
    }
  })

  it("has deprivationSource for all regions", () => {
    const validSources = ["IMD 2025", "WIMD 2025", "SIMD 2020", "NIMDM 2017"]
    for (const d of REGION_DEMOGRAPHICS) {
      expect(validSources).toContain(d.deprivationSource)
    }
  })

  it("has microAreaLabel for all regions", () => {
    const validLabels = ["LSOAs", "Data Zones", "SOAs"]
    for (const d of REGION_DEMOGRAPHICS) {
      expect(validLabels).toContain(d.microAreaLabel)
    }
  })
})

describe("evaluateDemographic fires for non-England regions", () => {
  it("scores Welsh stations with demographic signal", () => {
    // Use a known Welsh station — computeStationOpportunities covers all stations
    // Just verify that Welsh/Scottish/NI stations get a fired demographic signal
    const opportunities = computeStationOpportunities("Dominos")
    const welsh = opportunities.filter(o => o.station.region === "Wales")
    if (welsh.length > 0) {
      const demoSignal = welsh[0].signals.find(s => s.name === "demographic")
      expect(demoSignal).toBeDefined()
      expect(demoSignal!.source).not.toBe("No data")
    }
  })

  it("scores Scottish stations with demographic signal", () => {
    const opportunities = computeStationOpportunities("Dominos")
    const scottish = opportunities.filter(o => o.station.region === "Scotland")
    if (scottish.length > 0) {
      const demoSignal = scottish[0].signals.find(s => s.name === "demographic")
      expect(demoSignal).toBeDefined()
      expect(demoSignal!.source).not.toBe("No data")
    }
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npx vitest run src/test/demographic-normalization.test.ts
```

Expected: all 5 tests PASS (since Task 6 already generated the data).

- [ ] **Step 3: Update `evaluateDemographic` source fields (3 locations)**

In `src/lib/opportunity-scoring.ts`:

**Location 1 — fallback when no demo found (line ~283):**
Change `source: "IMD 2025",` to `source: "No data",`

**Location 2 — residential income path (line ~307):**
Change `source: "IMD 2025",` to `source: demo.deprivationSource,`

**Location 3 — `analyzeStation` missing data note (line ~561):**
Change:
```typescript
missingDataNotes.push(`Demographic data unavailable for ${station.region} (IMD covers England only)`)
```
to:
```typescript
missingDataNotes.push(`Demographic data unavailable for ${station.region}`)
```

- [ ] **Step 4: Update `generateNarrative` sources array**

At line ~716, change:
```typescript
sources: ["ORR 2024-25", "Getplace", "NaPTAN", "IMD 2025", "DfT AADF"],
```
to:
```typescript
sources: ["ORR 2024-25", "Getplace", "NaPTAN", "UK Deprivation Indices", "DfT AADF"],
```

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/opportunity-scoring.ts src/test/demographic-normalization.test.ts
git commit -m "feat: scoring engine uses deprivationSource from expanded demographic data"
```

---

### Task 7: Map visualization — dynamic imdColor and tooltips

**Files:**
- Modify: `src/components/explorer/MapView.tsx:96-99` (imdColor)
- Modify: `src/components/explorer/MapView.tsx:730-736` (tooltip)

- [ ] **Step 1: Replace hardcoded `imdColor` with dynamic min/max**

At `src/components/explorer/MapView.tsx`, replace:

```typescript
function imdColor(score: number): string {
  const t = Math.max(0, Math.min(1, (score - 14) / 16));
  return `rgb(${Math.round(34 + t * 205)},${Math.round(197 - t * 129)},${Math.round(94 - t * 26)})`;
}
```

with:

```typescript
const IMD_SCORES = REGION_DEMOGRAPHICS.map(d => d.avgImdScore);
const IMD_MIN = Math.min(...IMD_SCORES);
const IMD_MAX = Math.max(...IMD_SCORES);

function imdColor(score: number): string {
  const t = Math.max(0, Math.min(1, (score - IMD_MIN) / (IMD_MAX - IMD_MIN || 1)));
  return `rgb(${Math.round(34 + t * 205)},${Math.round(197 - t * 129)},${Math.round(94 - t * 26)})`;
}
```

- [ ] **Step 2: Update tooltip to use `deprivationSource` and `microAreaLabel`**

At line ~730, replace the tooltip template:

```typescript
layer.bindTooltip(`<div style="font-size:12px">
  <div style="font-weight:700;margin-bottom:4px">${escapeHtml(name)}</div>
  <div>Income decile: <strong>${demo.medianIncomeDecile}</strong>/10</div>
  <div>Deprivation score: <strong>${demo.avgImdScore.toFixed(1)}</strong></div>
  <div>Employment: <strong>${(demo.avgEmploymentScore * 100).toFixed(1)}%</strong></div>
  <div style="font-size:10px;color:#94a3b8;margin-top:2px">${demo.lsoaCount.toLocaleString()} LSOAs</div>
</div>`, { sticky: true });
```

with:

```typescript
layer.bindTooltip(`<div style="font-size:12px">
  <div style="font-weight:700;margin-bottom:4px">${escapeHtml(name)}</div>
  <div>Income decile: <strong>${demo.medianIncomeDecile}</strong>/10</div>
  <div>Deprivation score: <strong>${demo.avgImdScore.toFixed(1)}</strong></div>
  <div>Employment: <strong>${(demo.avgEmploymentScore * 100).toFixed(1)}%</strong></div>
  <div style="font-size:10px;color:#94a3b8;margin-top:2px">${demo.lsoaCount.toLocaleString()} ${demo.microAreaLabel} (${demo.deprivationSource})</div>
</div>`, { sticky: true });
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors (new fields `deprivationSource` and `microAreaLabel` exist in the generated data).

- [ ] **Step 4: Commit**

```bash
git add src/components/explorer/MapView.tsx
git commit -m "feat: dynamic imdColor range and source-aware tooltips for all UK regions"
```

---

### Task 8: ExecutiveBrief and ai-opportunity-analysis updates

**Files:**
- Modify: `src/components/explorer/opportunities/ExecutiveBrief.tsx:18-24`
- Modify: `src/data/ai-opportunity-analysis.ts` (multiple locations)

- [ ] **Step 1: Update SOURCE_RIBBON**

In `ExecutiveBrief.tsx`, replace:

```typescript
export const SOURCE_RIBBON = [
  { name: "ORR 2024-25", records: "2,587 stations" },
  { name: "NaPTAN", records: "371K stops" },
  { name: "DfT AADF", records: "5,000 roads" },
  { name: "IMD 2025", records: "33,755 LSOAs" },
  { name: "Census 2021", records: "7,264 MSOAs" },
  { name: "Getplace", records: "21,263 locations" },
] as const
```

with:

```typescript
export const SOURCE_RIBBON = [
  { name: "ORR 2024-25", records: "2,587 stations" },
  { name: "NaPTAN", records: "371K stops" },
  { name: "DfT AADF", records: "5,000 roads" },
  { name: "UK Deprivation Indices", records: "43.5K areas" },
  { name: "Census 2021", records: "7,264 MSOAs" },
  { name: "Getplace", records: "21,263 locations" },
] as const
```

- [ ] **Step 2: Update methodology table row**

In the same file, replace (line ~122):

```html
<tr ...><td ...>Demo fit</td><td ...>IMD 2025</td><td ...>15%</td><td>Income decile matches brand</td></tr>
```

with:

```html
<tr ...><td ...>Demo fit</td><td ...>UK Deprivation Indices</td><td ...>15%</td><td>Income decile matches brand</td></tr>
```

- [ ] **Step 3: Update ai-opportunity-analysis.ts disclaimers**

In `src/data/ai-opportunity-analysis.ts`, do a find-and-replace across the file:

Replace all instances of phrases like:
- `"IMD data is unavailable for Scotland"` → remove or replace with actual demographic info
- `"no demographic data available for Wales (IMD covers England only)"` → remove the caveat
- `"No IMD data for Scotland"` → remove
- `"No IMD data for Wales"` → remove
- `"Demographic data unavailable for Scotland (IMD covers England only)"` → remove
- `"Demographic data unavailable for Wales (IMD covers England only)"` → remove

This is a ~5,900-line static file. Use these specific regex replacements (in order):

1. Remove parenthetical IMD-only caveats:
   - Find: ` (IMD covers England only)` → Replace with: `` (empty)
   - Find: ` — IMD demographics, road traffic, and workplace population are all unavailable for Scotland` → Replace with: ` — road traffic and workplace population are unavailable for Scotland`
   - Find: ` — no demographic data available for Wales (IMD covers England only)` → Replace with: ``

2. Remove standalone "No IMD data" sentences/clauses:
   - Find: `No IMD data for Scotland limits demographic assessment for ` → Replace with: ``
   - Find: `No IMD data for Wales.` → Replace with: ``
   - Find: `No IMD data for Scotland.` → Replace with: ``
   - Find: `no demographic data for Scotland` → Replace with: `SIMD 2020 demographic data for Scotland`
   - Find: `no demographic data available for Wales` → Replace with: `WIMD 2025 demographic data for Wales`
   - Find: `no decile data for Scotland` → Replace with: `SIMD 2020 decile data for Scotland`
   - Find: `no decile data for Wales` → Replace with: `WIMD 2025 decile data for Wales`

3. Update "Demographic data unavailable" lines:
   - Find: `Demographic data unavailable for Scotland (IMD covers England only)` → Replace with: ``
   - Find: `Demographic data unavailable for Wales (IMD covers England only)` → Replace with: ``

4. Update data completeness percentages (since adding demographics improves completeness):
   - This is context-dependent. Where a station's `riskMitigation` says "Data completeness is 57%" or "71%" specifically because of missing demographics, the percentage increases by ~14% (the demographic signal weight). Update these case-by-case.

After all replacements, grep for remaining occurrences:
```bash
grep -n "IMD covers England\|No IMD data\|no demographic data\|unavailable for Scotland\|unavailable for Wales" src/data/ai-opportunity-analysis.ts
```
Fix any remaining instances manually. Verify no broken sentences resulted from the replacements.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/explorer/opportunities/ExecutiveBrief.tsx src/data/ai-opportunity-analysis.ts
git commit -m "chore: update data source labels and remove stale IMD-only disclaimers"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 3: Visual verification**

```bash
npm run dev
```

Open the app in browser:
1. Go to Explorer
2. Toggle "Deprivation index" layer
3. Verify Wales, Scotland, Northern Ireland are colored (not white)
4. Hover over Wales — tooltip shows "WIMD 2025"
5. Hover over Scotland — tooltip shows "SIMD 2020"
6. Hover over Northern Ireland — tooltip shows "NIMDM 2017"
7. Toggle "Income level" layer — all 12 regions have colors

- [ ] **Step 4: Final commit**

If any fixes were needed during verification:
```bash
git add -A
git commit -m "fix: address issues found during visual verification"
```
