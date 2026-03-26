#!/usr/bin/env python3
"""
Enrich station-data.ts with localIncomeDecile from nearby LSOA/DataZone micro-areas.

For each station, finds all micro-areas (LSOAs for England/Wales, DataZones for Scotland)
within 1.5km and takes the median income decile of those areas. Deciles are computed
UK-wide (1 = most deprived, 10 = least deprived) so London stations should rank higher
than their regional IMD score would suggest, reflecting local affluence of nearby areas.

Sources:
  - lsoa-centroids-2021.csv: LSOA 2021 population-weighted centroids
  - dz-centroids-2011.csv: Scotland DataZone 2011 centroids
  - imd-2025-file7.csv: IMD 2025 England LSOA income deprivation rates
  - wimd-2025-scores.ods: WIMD 2025 Wales LSOA income scores
  - simd-2020v2-indicators.xlsx: SIMD 2020v2 Scotland DataZone income rates

Output: Rewrites station-data.ts with new `localIncomeDecile` field.
"""

import csv
import re
import math
import os
import statistics

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
    """Load micro-area centroids from LSOA (England/Wales) and DataZone (Scotland) files.

    Returns dict: {code: (lat, lon)}
    """
    centroids = {}

    # England and Wales LSOAs (2021 boundaries)
    lsoa_path = os.path.join(EXT_DIR, "lsoa-centroids-2021.csv")
    with open(lsoa_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row["LSOA21CD"].strip()
            lat = float(row["lat"].strip())
            lon = float(row["lon"].strip())
            centroids[code] = (lat, lon)
    print(f"  Loaded {len(centroids)} LSOA centroids (England & Wales)")

    # Scotland DataZones (2011 boundaries)
    dz_path = os.path.join(EXT_DIR, "dz-centroids-2011.csv")
    before = len(centroids)
    with open(dz_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row["DataZone"].strip()
            lat = float(row["lat"].strip())
            lon = float(row["lon"].strip())
            centroids[code] = (lat, lon)
    print(f"  Loaded {len(centroids) - before} DataZone centroids (Scotland)")
    print(f"  Total micro-areas with centroids: {len(centroids)}")
    return centroids


def load_income_rates():
    """Load income deprivation rates from England, Wales, and Scotland sources.

    Returns dict: {code: income_rate} where income_rate is a 0-1 value
    (higher = more deprived, i.e. lower income).
    """
    try:
        import pandas as pd
    except ImportError:
        raise ImportError("pandas is required: pip install pandas openpyxl odfpy")

    rates = {}

    # England: IMD 2025 File 7 — Income Score (rate) is already 0-1
    imd_path = os.path.join(EXT_DIR, "imd-2025-file7.csv")
    df_eng = pd.read_csv(imd_path, encoding="utf-8-sig")
    for _, row in df_eng.iterrows():
        code = str(row["LSOA code (2021)"]).strip()
        rate = float(row["Income Score (rate)"])
        rates[code] = rate
    print(f"  Loaded {len(rates)} England LSOA income rates (IMD 2025)")

    # Wales: WIMD 2025 — Income column is 0-100 score (higher = less deprived),
    # convert to deprivation rate by inverting: rate = (100 - score) / 100
    wimd_path = os.path.join(EXT_DIR, "wimd-2025-scores.ods")
    df_wal = pd.read_excel(wimd_path, engine="odf", sheet_name="Data", skiprows=3)
    # Strip whitespace from column names (WIMD has trailing spaces)
    df_wal.columns = [str(c).strip() for c in df_wal.columns]
    before = len(rates)
    for _, row in df_wal.iterrows():
        code_val = row["LSOA code"]
        income_val = row["Income"]
        if pd.isna(code_val) or pd.isna(income_val):
            continue
        code = str(code_val).strip()
        # WIMD Income is a score where higher = less deprived, so invert for rate
        rate = (100.0 - float(income_val)) / 100.0
        rates[code] = rate
    print(f"  Loaded {len(rates) - before} Wales LSOA income rates (WIMD 2025)")

    # Scotland: SIMD 2020v2 — Income_rate is already 0-1
    simd_path = os.path.join(EXT_DIR, "simd-2020v2-indicators.xlsx")
    df_sco = pd.read_excel(simd_path, sheet_name="Data")
    before = len(rates)
    for _, row in df_sco.iterrows():
        code_val = row["Data_Zone"]
        rate_val = row["Income_rate"]
        if pd.isna(code_val) or pd.isna(rate_val):
            continue
        code = str(code_val).strip()
        rate_str = str(rate_val).strip()
        # SIMD uses '*' for suppressed values — skip them
        if rate_str in ("*", "", "na", "NA"):
            continue
        try:
            rate = float(rate_str)
        except ValueError:
            continue
        rates[code] = rate
    print(f"  Loaded {len(rates) - before} Scotland DataZone income rates (SIMD 2020v2)")
    print(f"  Total micro-areas with income data: {len(rates)}")
    return rates


def compute_uk_deciles(rates):
    """Assign UK-wide income deciles to all micro-areas.

    Sorts by income_rate descending (highest rate = most deprived = decile 1).
    Decile 1 = most deprived (highest deprivation rate).
    Decile 10 = least deprived (lowest deprivation rate).

    Returns dict: {code: decile (1-10)}
    """
    # Sort descending: most deprived (high rate) first → gets decile 1
    sorted_codes = sorted(rates.keys(), key=lambda c: rates[c], reverse=True)
    n = len(sorted_codes)
    deciles = {}
    for i, code in enumerate(sorted_codes):
        # percentile 0..1 where 0 = most deprived, 1 = least deprived
        percentile = i / n
        # decile 1 = most deprived, 10 = least deprived
        decile = min(10, int(percentile * 10) + 1)
        deciles[code] = decile
    print(f"  Computed UK-wide deciles for {len(deciles)} micro-areas")
    # Sanity check: verify distribution is roughly uniform
    from collections import Counter
    dist = Counter(deciles.values())
    print(f"  Decile distribution: {dict(sorted(dist.items()))}")
    return deciles


def find_local_income_decile(station_lat, station_lon, centroids, deciles, radius_km):
    """Find distance-weighted median income decile of micro-areas within radius.

    Uses inverse-distance-squared weighting so the micro-areas immediately around
    the station (the actual catchment) dominate over distant ones at the radius edge.
    Uses bounding box pre-filter then haversine for exact distance.
    Returns 0 if no micro-areas found within radius.
    """
    # Approx degree tolerances for bounding box pre-filter at UK latitudes
    lat_tol = radius_km * 0.009
    lon_tol = radius_km * 0.015

    nearby = []
    for code, (lat, lon) in centroids.items():
        if abs(lat - station_lat) > lat_tol:
            continue
        if abs(lon - station_lon) > lon_tol:
            continue
        dist = haversine(station_lat, station_lon, lat, lon)
        if dist <= radius_km:
            decile = deciles.get(code)
            if decile is not None:
                nearby.append((dist, decile))

    if not nearby:
        return 0

    # Distance-weighted median: each micro-area weighted by 1/(dist+0.1)^2
    # +0.1 avoids division by zero for exact centroid overlap
    weighted = []
    for dist, decile in nearby:
        weight = 1.0 / (dist + 0.1) ** 2
        weighted.append((decile, weight))

    # Compute weighted median: sort by decile, accumulate weights, find 50th percentile
    weighted.sort(key=lambda x: x[0])
    total_weight = sum(w for _, w in weighted)
    cumulative = 0.0
    for decile, weight in weighted:
        cumulative += weight
        if cumulative >= total_weight / 2:
            return decile
    return weighted[-1][0]


def parse_stations(content):
    """Parse station records from TypeScript file including all fields up to estWorkerSalary."""
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
    """Generate TypeScript file content with localIncomeDecile field."""
    lines = [
        '// UK rail station data enriched with QSR proximity, bus density, workplace population, worker salary, and local income decile',
        '// Sources: ORR 2024-25, NaPTAN, Getplace brand data, Census 2021 WP001, NOMIS Business Counts 2024, ONS ASHE 2023',
        '//          IMD 2025 (England), WIMD 2025 (Wales), SIMD 2020v2 (Scotland)',
        '// Generated by scripts/convert-stations.py + convert-bus-density.py + convert-workplace-pop.py',
        '//           + convert-worker-salary.py + convert-local-income.py',
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


def main():
    print("=== Enriching station data with UK-wide local income deciles ===")
    print()

    # Load centroids for all micro-areas
    print("Loading micro-area centroids...")
    centroids = load_centroids()

    # Load income rates from all three nations
    print("\nLoading income deprivation rates...")
    rates = load_income_rates()

    # Compute UK-wide deciles
    print("\nComputing UK-wide income deciles...")
    deciles = compute_uk_deciles(rates)

    # Parse existing stations
    print(f"\nParsing stations from {STATION_FILE}...")
    with open(STATION_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    stations = parse_stations(content)
    print(f"  Parsed {len(stations)} stations")

    # Compute local income decile for each station
    print(f"\nComputing local income decile within {RADIUS_KM}km for each station...")
    stations_with_data = 0
    stations_zero = 0
    for i, s in enumerate(stations):
        decile = find_local_income_decile(
            s["lat"], s["lon"], centroids, deciles, RADIUS_KM
        )
        s["localIncomeDecile"] = decile
        if decile > 0:
            stations_with_data += 1
        else:
            stations_zero += 1
        if (i + 1) % 500 == 0:
            print(f"  Processed {i + 1}/{len(stations)} stations...")

    print(f"\n  Stations with local income data: {stations_with_data}/{len(stations)}")
    print(f"  Stations with no nearby micro-areas (0): {stations_zero}")

    # Spot-check key stations for sanity
    key_names = [
        "London Liverpool Street",
        "London Waterloo",
        "Stratford (London)",
        "Whitechapel",
        "Manchester Piccadilly",
        "Bradford Interchange",
        "Edinburgh Waverley",
        "Bristol Temple Meads",
    ]
    print("\n  Key stations (spot-check):")
    for name in key_names:
        station = next((s for s in stations if s["name"] == name), None)
        if station:
            print(f"    {name}: localIncomeDecile={station['localIncomeDecile']}")

    # Write output
    print(f"\nWriting enriched data to {STATION_FILE}...")
    output = generate_ts(stations)
    with open(STATION_FILE, "w", encoding="utf-8") as f:
        f.write(output)
    print(f"  Written {len(stations)} stations with localIncomeDecile field")
    print("\n=== Done ===")


if __name__ == "__main__":
    main()
