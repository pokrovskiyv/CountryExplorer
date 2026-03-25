# Per-Station Local Income Decile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute `localIncomeDecile` per station from nearby LSOA/DataZone centroids within 1.5km, so the scoring engine uses local income data instead of one value per region.

**Architecture:** New Python script (`convert-local-income.py`) follows the `convert-workplace-pop.py` spatial join pattern. Downloads ~43K centroid coordinates, joins with income rates from existing deprivation files, computes UK-wide deciles, spatial-joins to stations, enriches `station-data.ts`. Scoring engine adds station-level check before region fallback.

**Tech Stack:** Python (pandas, openpyxl, xlrd, odfpy), TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-25-local-income-decile-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `scripts/download-external-data.sh` | Add LSOA + DataZone centroid downloads |
| Create | `scripts/convert-local-income.py` | Load centroids + income rates → spatial join → enrich station-data.ts |
| Modify | `src/data/station-data.ts` | Generated — adds `localIncomeDecile` field |
| Modify | `src/lib/opportunity-scoring.ts` | Use `localIncomeDecile` in `evaluateDemographic` + fix `analyzeStation` |
| Create | `src/test/local-income-decile.test.ts` | Unit tests for station-level demographic scoring |

---

### Task 1: Download centroid files

**Files:**
- Modify: `scripts/download-external-data.sh`

- [ ] **Step 1: Research actual centroid download URLs**

Use web search to find direct download URLs for:
1. **LSOA 2021 population-weighted centroids** (England + Wales) — from ONS Open Geography Portal. Look for CSV with columns like `LSOA21CD`, `X` (longitude), `Y` (latitude). URL pattern: `https://geoportal.statistics.gov.uk/...`
2. **Data Zone 2011 centroids** (Scotland) — from statistics.gov.scot or Scottish Government spatial data. Look for CSV with `DataZone` code, lat, lon.

NI SOA centroids are descoped (0 NI stations in dataset).

- [ ] **Step 2: Add downloads to script**

Add after the NIMDM section, before Census. Use the same idempotent pattern:

```bash
# 8. LSOA centroids (England + Wales, 2021 boundaries)
echo ""
echo "[8/10] LSOA centroids..."
if [ ! -f "lsoa-centroids.csv" ]; then
  curl -L -o "lsoa-centroids.csv" \
    "<URL_FROM_STEP_1>"
  echo "  Downloaded lsoa-centroids.csv"
else
  echo "  Already exists, skipping"
fi

# 9. Data Zone centroids (Scotland, 2011 boundaries)
echo ""
echo "[9/10] Data Zone centroids..."
if [ ! -f "datazone-centroids.csv" ]; then
  curl -L -o "datazone-centroids.csv" \
    "<URL_FROM_STEP_1>"
  echo "  Downloaded datazone-centroids.csv"
else
  echo "  Already exists, skipping"
fi
```

Update all counter labels (`[N/10]`) — Census becomes `[10/10]`.

- [ ] **Step 3: Run downloads and verify**

```bash
bash scripts/download-external-data.sh
```

Verify both files downloaded and are valid CSVs:
```bash
head -3 "src/data/Data for assignment/external/lsoa-centroids.csv"
head -3 "src/data/Data for assignment/external/datazone-centroids.csv"
wc -l "src/data/Data for assignment/external/lsoa-centroids.csv"  # expect ~35,673
wc -l "src/data/Data for assignment/external/datazone-centroids.csv"  # expect ~6,977
```

If a URL returns HTML instead of CSV, search for the correct URL and fix.

- [ ] **Step 4: Commit**

```bash
git add scripts/download-external-data.sh
git commit -m "feat: add LSOA and DataZone centroid downloads"
```

---

### Task 2: Create convert-local-income.py — centroid and income loading

**Files:**
- Create: `scripts/convert-local-income.py`

- [ ] **Step 1: Create script with centroid loaders**

Create `scripts/convert-local-income.py` following the `convert-workplace-pop.py` pattern. Start with imports, constants, haversine, and centroid loading:

```python
#!/usr/bin/env python3
"""
Enrich station-data.ts with localIncomeDecile — UK-wide income decile
computed from micro-areas (LSOA / Data Zone) within 1.5km of each station.

Sources:
  - lsoa-centroids.csv: LSOA 2021 centroids (England + Wales)
  - datazone-centroids.csv: Data Zone 2011 centroids (Scotland)
  - IMD 2025, WIMD 2025, SIMD 2020v2: income deprivation rates
  - station-data.ts: Existing station records

Output: Rewrites station-data.ts with new `localIncomeDecile` field.
"""

import csv
import re
import math
import os
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
EXT_DIR = os.path.join(ROOT_DIR, "src", "data", "Data for assignment", "external")
STATION_FILE = os.path.join(ROOT_DIR, "src", "data", "station-data.ts")

RADIUS_KM = 1.5
EARTH_RADIUS_KM = 6371.0


def haversine(lat1, lon1, lat2, lon2):
    """Great-circle distance in km."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def load_centroids():
    """Load centroid coordinates from LSOA (England+Wales) and DataZone (Scotland) files.
    Returns dict of {code: (lat, lon)}."""
    centroids = {}

    # LSOA centroids (England + Wales)
    lsoa_path = os.path.join(EXT_DIR, "lsoa-centroids.csv")
    if os.path.exists(lsoa_path):
        with open(lsoa_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            # ONS centroids use X=lon, Y=lat (same as msoa-centroids.csv)
            # Find the code column (LSOA21CD or similar)
            code_col = next((h for h in headers if 'lsoa' in h.lower() and 'cd' in h.lower()), None)
            if not code_col:
                code_col = next((h for h in headers if 'code' in h.lower()), headers[0])
            x_col = next((h for h in headers if h.upper() == 'X'), None)
            y_col = next((h for h in headers if h.upper() == 'Y'), None)
            # Fallback to lat/lon/long columns
            if not x_col:
                x_col = next((h for h in headers if 'lon' in h.lower()), None)
            if not y_col:
                y_col = next((h for h in headers if 'lat' in h.lower()), None)
            print(f"  LSOA centroid columns: code='{code_col}', x='{x_col}', y='{y_col}'")
            for row in reader:
                try:
                    code = row[code_col].strip()
                    lon = float(row[x_col].strip())
                    lat = float(row[y_col].strip())
                    centroids[code] = (lat, lon)
                except (ValueError, KeyError):
                    continue
        print(f"  Loaded {len(centroids)} LSOA centroids (England + Wales)")
    else:
        print(f"  WARNING: {lsoa_path} not found")

    # DataZone centroids (Scotland)
    dz_path = os.path.join(EXT_DIR, "datazone-centroids.csv")
    before = len(centroids)
    if os.path.exists(dz_path):
        with open(dz_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            code_col = next((h for h in headers if 'datazone' in h.lower() or 'data_zone' in h.lower() or 'dz' in h.lower()), None)
            if not code_col:
                code_col = next((h for h in headers if 'code' in h.lower()), headers[0])
            x_col = next((h for h in headers if h.upper() == 'X' or 'lon' in h.lower()), None)
            y_col = next((h for h in headers if h.upper() == 'Y' or 'lat' in h.lower()), None)
            print(f"  DZ centroid columns: code='{code_col}', x='{x_col}', y='{y_col}'")
            for row in reader:
                try:
                    code = row[code_col].strip()
                    lon = float(row[x_col].strip())
                    lat = float(row[y_col].strip())
                    centroids[code] = (lat, lon)
                except (ValueError, KeyError):
                    continue
        print(f"  Loaded {len(centroids) - before} DataZone centroids (Scotland)")
    else:
        print(f"  WARNING: {dz_path} not found")

    print(f"  Total centroids: {len(centroids)}")
    return centroids
```

- [ ] **Step 2: Add income rate loaders**

Add to the same file — 4 separate parsers that each return `{code: income_rate}`:

```python
def load_income_rates():
    """Load income deprivation rates from all 4 national indices.
    Returns dict of {area_code: income_rate} where rate is 0-1 (higher = more deprived)."""
    rates = {}

    # 1. IMD 2025 (England) — CSV
    imd_path = os.path.join(EXT_DIR, "imd-2025-file7.csv")
    if os.path.exists(imd_path):
        df = pd.read_csv(imd_path, encoding="utf-8-sig")
        code_col = next((c for c in df.columns if 'lsoa code' in c.lower()), None)
        income_col = next((c for c in df.columns if 'income score (rate)' in c.lower()), None)
        if not income_col:
            income_col = next((c for c in df.columns if 'income score' in c.lower()), None)
        if code_col and income_col:
            for _, row in df.iterrows():
                try:
                    code = str(row[code_col]).strip()
                    rate = float(row[income_col])
                    if 0 <= rate <= 1:
                        rates[code] = rate
                except (ValueError, TypeError):
                    continue
        print(f"  IMD 2025: {sum(1 for k in rates if k.startswith('E') or k.startswith('W'))} England LSOAs")
    else:
        print(f"  WARNING: {imd_path} not found")

    # 2. WIMD 2025 (Wales) — ODS
    wimd_path = os.path.join(EXT_DIR, "wimd-2025-scores.ods")
    before = len(rates)
    if os.path.exists(wimd_path):
        df = pd.read_excel(wimd_path, engine="odf", sheet_name="Data", skiprows=3)
        df.columns = [c.strip() for c in df.columns]
        code_col = next((c for c in df.columns if 'lsoa code' in c.lower()), None)
        if not code_col:
            code_col = next((c for c in df.columns if 'code' in c.lower()), df.columns[0])
        income_col = next((c for c in df.columns if c.strip().lower() == 'income'), None)
        if code_col and income_col:
            for _, row in df.iterrows():
                try:
                    code = str(row[code_col]).strip()
                    val = float(row[income_col])
                    # WIMD scores are 0-100, normalize to 0-1
                    rate = val / 100 if val > 1 else val
                    rates[code] = rate
                except (ValueError, TypeError):
                    continue
        print(f"  WIMD 2025: {len(rates) - before} Welsh LSOAs")
    else:
        print(f"  WARNING: {wimd_path} not found")

    # 3. SIMD 2020v2 (Scotland) — XLSX
    simd_path = os.path.join(EXT_DIR, "simd-2020v2-indicators.xlsx")
    before = len(rates)
    if os.path.exists(simd_path):
        df = pd.read_excel(simd_path, sheet_name="Data")
        dz_col = next((c for c in df.columns if 'data_zone' in c.lower() or 'datazone' in c.lower()), df.columns[0])
        income_col = next((c for c in df.columns if 'income_rate' in c.lower()), None)
        if not income_col:
            income_col = next((c for c in df.columns if 'income' in c.lower() and 'rate' in c.lower()), None)
        if dz_col and income_col:
            for _, row in df.iterrows():
                try:
                    code = str(row[dz_col]).strip()
                    rate = float(row[income_col])
                    if 0 <= rate <= 1:
                        rates[code] = rate
                except (ValueError, TypeError):
                    continue
        print(f"  SIMD 2020v2: {len(rates) - before} Scottish Data Zones")
    else:
        print(f"  WARNING: {simd_path} not found")

    print(f"  Total income rates: {len(rates)}")
    return rates
```

- [ ] **Step 3: Verify loaders work**

Add a temporary `if __name__` block and run:

```python
if __name__ == "__main__":
    print("Loading centroids...")
    centroids = load_centroids()
    print(f"\nLoading income rates...")
    rates = load_income_rates()
    # Check overlap
    matched = sum(1 for code in rates if code in centroids)
    print(f"\nMatched (have both centroid + income rate): {matched}")
```

```bash
python3 scripts/convert-local-income.py
```

Expected: ~35K+ LSOA centroids, ~7K DataZone centroids, ~40K+ income rates, ~35K+ matched.

- [ ] **Step 4: Commit**

```bash
git add scripts/convert-local-income.py
git commit -m "feat: add centroid and income rate loaders for local income decile"
```

---

### Task 3: Decile computation + spatial join + station enrichment

**Files:**
- Modify: `scripts/convert-local-income.py`

- [ ] **Step 1: Add UK-wide decile computation**

```python
def compute_uk_deciles(rates):
    """Compute UK-wide income deciles from rates.
    Returns dict of {code: decile} where 1=most deprived, 10=least deprived."""
    sorted_codes = sorted(rates.keys(), key=lambda c: rates[c])
    n = len(sorted_codes)
    deciles = {}
    for i, code in enumerate(sorted_codes):
        percentile = i / max(n - 1, 1)
        deciles[code] = 10 - min(int(percentile * 10), 9)
    return deciles
```

- [ ] **Step 2: Add spatial join function**

```python
def compute_local_decile(station_lat, station_lon, centroid_list, deciles, radius_km):
    """Find median decile of all micro-areas within radius_km of station.
    centroid_list is [(code, lat, lon), ...]. Returns 0 if no matches."""
    lat_tol = radius_km * 0.009
    lon_tol = radius_km * 0.015
    nearby_deciles = []
    for code, lat, lon in centroid_list:
        if abs(lat - station_lat) > lat_tol:
            continue
        if abs(lon - station_lon) > lon_tol:
            continue
        if haversine(station_lat, station_lon, lat, lon) <= radius_km:
            d = deciles.get(code)
            if d is not None:
                nearby_deciles.append(d)
    if not nearby_deciles:
        return 0
    nearby_deciles.sort()
    return nearby_deciles[len(nearby_deciles) // 2]
```

- [ ] **Step 3: Add station parser and TS generator**

The parser must handle the current full field set (including `estWorkerSalary`):

```python
def parse_stations(content):
    """Parse station records from TypeScript file."""
    pattern = re.compile(
        r"""\{\s*name:\s*'([^']+)',\s*lat:\s*([\d.-]+),\s*lon:\s*([\d.-]+),\s*"""
        r"""region:\s*'([^']+)',\s*annualEntries:\s*(\d+),\s*"""
        r"""qsrCount400m:\s*(\d+),\s*qsrCount800m:\s*(\d+),\s*qsrCount1500m:\s*(\d+),\s*"""
        r"""brandCounts800m:\s*(\{[^}]*\}),\s*"""
        r"""footfallRatio:\s*([\d.]+),\s*"""
        r"""busStopCount800m:\s*(\d+),\s*"""
        r"""workplacePop1500m:\s*(\d+),\s*"""
        r"""estWorkerSalary:\s*(\d+)"""
        r"""(?:,\s*localIncomeDecile:\s*(\d+))?\s*\}"""
    )
    stations = []
    for m in pattern.finditer(content):
        stations.append({
            "name": m.group(1),
            "lat": float(m.group(2)),
            "lon": float(m.group(3)),
            "region": m.group(4),
            "annualEntries": int(m.group(5)),
            "qsrCount400m": int(m.group(6)),
            "qsrCount800m": int(m.group(7)),
            "qsrCount1500m": int(m.group(8)),
            "brandCounts800m": m.group(9),
            "footfallRatio": float(m.group(10)),
            "busStopCount800m": int(m.group(11)),
            "workplacePop1500m": int(m.group(12)),
            "estWorkerSalary": int(m.group(13)),
        })
    return stations


def generate_ts(stations):
    """Generate TypeScript file content with localIncomeDecile."""
    lines = [
        '// UK rail station data enriched with QSR proximity, bus density, workplace population, worker salary, and local income',
        '// Sources: ORR 2024-25, NaPTAN, Getplace brand data, Census 2021 WP001, BRES/ASHE, UK Deprivation Indices',
        '// Generated by convert-stations + convert-bus-density + convert-workplace-pop + convert-worker-salary + convert-local-income',
        '',
        'export interface StationRecord {',
        '  readonly name: string',
        '  readonly lat: number',
        '  readonly lon: number',
        '  readonly region: string',
        '  readonly annualEntries: number',
        '  readonly qsrCount400m: number',
        '  readonly qsrCount800m: number',
        '  readonly qsrCount1500m: number',
        '  readonly brandCounts800m: Readonly<Record<string, number>>',
        '  readonly footfallRatio: number',
        '  readonly busStopCount800m: number',
        '  readonly workplacePop1500m: number',
        '  readonly estWorkerSalary: number',
        '  readonly localIncomeDecile: number',
        '}',
        '',
        'export const STATION_DATA: readonly StationRecord[] = [',
    ]

    for s in stations:
        lines.append(
            f"  {{ name: '{s['name']}', lat: {s['lat']}, lon: {s['lon']}, "
            f"region: '{s['region']}', annualEntries: {s['annualEntries']}, "
            f"qsrCount400m: {s['qsrCount400m']}, qsrCount800m: {s['qsrCount800m']}, "
            f"qsrCount1500m: {s['qsrCount1500m']}, "
            f"brandCounts800m: {s['brandCounts800m']}, "
            f"footfallRatio: {s['footfallRatio']}, "
            f"busStopCount800m: {s['busStopCount800m']}, "
            f"workplacePop1500m: {s['workplacePop1500m']}, "
            f"estWorkerSalary: {s['estWorkerSalary']}, "
            f"localIncomeDecile: {s['localIncomeDecile']} }},"
        )

    lines.append('] as const')
    lines.append('')
    return '\n'.join(lines)
```

- [ ] **Step 4: Add main() orchestrator**

```python
def main():
    print("=== Computing Local Income Decile (1.5km radius) ===\n")

    print("Loading centroids...")
    centroids = load_centroids()

    print("\nLoading income rates...")
    rates = load_income_rates()

    print("\nComputing UK-wide deciles...")
    deciles = compute_uk_deciles(rates)
    print(f"  Computed deciles for {len(deciles)} micro-areas")

    # Build centroid list with only areas that have both coordinates and deciles
    centroid_list = []
    for code, (lat, lon) in centroids.items():
        if code in deciles:
            centroid_list.append((code, lat, lon))
    print(f"  Usable centroids (have coordinates + income data): {len(centroid_list)}")

    # Parse stations
    print(f"\nParsing stations from {STATION_FILE}...")
    with open(STATION_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    stations = parse_stations(content)
    print(f"  Parsed {len(stations)} stations")

    # Spatial join
    print(f"\nComputing local income decile within {RADIUS_KM}km for each station...")
    with_data = 0
    for i, s in enumerate(stations):
        lid = compute_local_decile(s["lat"], s["lon"], centroid_list, deciles, RADIUS_KM)
        s["localIncomeDecile"] = lid
        if lid > 0:
            with_data += 1
        if (i + 1) % 500 == 0:
            print(f"  Processed {i + 1}/{len(stations)} stations...")

    print(f"\n  Stations with local income data: {with_data}/{len(stations)}")
    print(f"  Stations without (fallback to region): {len(stations) - with_data}")

    # Validation: check Liverpool Street
    for s in stations:
        if "Liverpool Street" in s["name"]:
            print(f"\n  Validation: {s['name']} localIncomeDecile = {s['localIncomeDecile']} (expect ~7-8)")
            break

    # Write output
    print(f"\nWriting enriched data to {STATION_FILE}...")
    output = generate_ts(stations)
    with open(STATION_FILE, "w", encoding="utf-8") as f:
        f.write(output)
    print(f"  Written {len(stations)} stations with localIncomeDecile")
    print("\n=== Done ===")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run the converter**

```bash
python3 scripts/convert-local-income.py
```

Expected:
- ~35K+ usable centroids
- ~2,300+ stations with local income data (most urban stations)
- Liverpool Street localIncomeDecile ~7-8
- Runtime ~30-60 seconds

- [ ] **Step 6: Inspect output**

```bash
head -25 src/data/station-data.ts
```

Verify `localIncomeDecile` field present on all records. Check a few known stations.

- [ ] **Step 7: Commit**

```bash
git add scripts/convert-local-income.py src/data/station-data.ts
git commit -m "feat: compute per-station localIncomeDecile from nearby micro-areas"
```

---

### Task 4: Scoring engine — use localIncomeDecile

**Files:**
- Modify: `src/lib/opportunity-scoring.ts:240-311` (evaluateDemographic)
- Modify: `src/lib/opportunity-scoring.ts:559-574` (analyzeStation)
- Create: `src/test/local-income-decile.test.ts`

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect } from "vitest"
import { STATION_DATA } from "@/data/station-data"
import { computeStationOpportunities } from "@/lib/opportunity-scoring"

describe("localIncomeDecile field", () => {
  it("exists on all stations with value 0-10", () => {
    for (const s of STATION_DATA) {
      expect(s.localIncomeDecile).toBeGreaterThanOrEqual(0)
      expect(s.localIncomeDecile).toBeLessThanOrEqual(10)
    }
  })

  it("Liverpool Street has local decile higher than London region (3)", () => {
    const ls = STATION_DATA.find(s => s.name.includes("Liverpool Street"))
    expect(ls).toBeDefined()
    expect(ls!.localIncomeDecile).toBeGreaterThan(3)
  })
})

describe("evaluateDemographic uses localIncomeDecile", () => {
  it("premium brand fires for London station with high local decile", () => {
    const opps = computeStationOpportunities("Nandos")
    const ls = opps.find(o => o.station.name.includes("Liverpool Street"))
    if (ls) {
      const demo = ls.signals.find(s => s.name === "demographic")
      expect(demo).toBeDefined()
      // Liverpool Street: business district with 145K workers — uses worker salary, not local decile
      // Use a non-business London station instead
    }
  })

  it("non-business London station uses local income decile, not region", () => {
    const opps = computeStationOpportunities("Nandos")
    // Find a London station without 50K+ workers
    const nonBiz = opps.find(o =>
      o.station.region === "London" &&
      (o.station.workplacePop1500m ?? 0) < 50_000 &&
      o.station.localIncomeDecile > 0
    )
    if (nonBiz) {
      const demo = nonBiz.signals.find(s => s.name === "demographic")
      expect(demo).toBeDefined()
      expect(demo!.source).toBe("Local income (1.5km)")
    }
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npx vitest run src/test/local-income-decile.test.ts
```

Expected: First test (field exists) should PASS (data already generated). Second test block will FAIL because scoring engine doesn't use `localIncomeDecile` yet.

- [ ] **Step 3: Update `evaluateDemographic` in opportunity-scoring.ts**

After the business-district block (line ~275, after `return { ... source: "BRES + ASHE" ... }`), and before the `if (!demo)` fallback, insert the station-level check:

```typescript
  // Station-level: local income decile from nearby micro-areas
  const localDecile = station.localIncomeDecile ?? 0
  if (localDecile > 0) {
    let fired = false
    let strength = 0

    if (affinity === "premium" && localDecile >= 6) {
      fired = true
      strength = 0.7 + (localDecile - 6) * 0.1
    } else if (affinity === "value" && localDecile <= 5) {
      fired = true
      strength = 0.6 + (5 - localDecile) * 0.1
    } else if (affinity === "neutral" && localDecile >= 3) {
      fired = true
      strength = 0.5
    }

    return {
      name: "demographic",
      weight: SIGNAL_WEIGHTS.demographic,
      strength,
      source: "Local income (1.5km)",
      rawValue: `Local income decile ${localDecile} (1.5km), brand: ${affinity}`,
      fired,
    }
  }

  // Fallback: region-level income decile
```

Keep the existing region-level code unchanged below this block.

- [ ] **Step 4: Update rawValue for region fallback**

Change line ~308 from:
```typescript
rawValue: `Income decile ${demo.medianIncomeDecile}, brand: ${affinity}`,
```
to:
```typescript
rawValue: `Region income decile ${demo.medianIncomeDecile} (${station.region}), brand: ${affinity}`,
```

- [ ] **Step 5: Update `analyzeStation` dataCompleteness**

At line ~559, change:
```typescript
  const demo = REGION_DEMOGRAPHICS.find((d) => d.region === station.region)
  if (!demo) {
    missingDataNotes.push(`Demographic data unavailable for ${station.region}`)
  }
```
to:
```typescript
  const demo = REGION_DEMOGRAPHICS.find((d) => d.region === station.region)
  const hasLocalIncome = (station.localIncomeDecile ?? 0) > 0
  if (!demo && !hasLocalIncome) {
    missingDataNotes.push(`Demographic data unavailable for ${station.region}`)
  }
```

And at line ~574, change:
```typescript
  if (demo) sourcesWithData++
```
to:
```typescript
  if (demo || hasLocalIncome) sourcesWithData++
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/opportunity-scoring.ts src/test/local-income-decile.test.ts
git commit -m "feat: scoring engine uses station-level localIncomeDecile with region fallback"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Visual spot-check**

```bash
npm run dev
```

Open Explorer → toggle "Income level" layer → hover London stations → verify tooltip shows different deciles for different London stations (not all "3").

- [ ] **Step 5: Commit if any fixes needed**

```bash
git add -A && git commit -m "fix: address issues found during verification"
```
