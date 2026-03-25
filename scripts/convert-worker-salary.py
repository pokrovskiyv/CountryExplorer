#!/usr/bin/env python3
"""
Enrich station-data.ts with estimated median worker salary from SIC-weighted analysis.

Pipeline:
  1. Load MSOA centroids + MSOA-to-LA mapping → compute LA centroids
  2. Load Business Counts by LA × SIC section (NOMIS)
  3. Load ASHE median pay by SIC section (ONS)
  4. For each station: find nearest LA → compute weighted avg salary
     salary = Σ(businesses_in_SIC × median_pay_SIC) / total_businesses

Sources:
  - business-counts-la-sic.csv: UK Business Counts 2024 (NOMIS NM_141_1, OGL v3.0)
  - ashe-median-pay-by-sic.csv: ONS ASHE 2023 Table 16.5a (OGL v3.0)
  - msoa-centroids.csv: ONS MSOA Population Weighted Centroids (OGL v3.0)
  - msoa-names-lad.csv: House of Commons Library MSOA Names 2.2

Output: Rewrites station-data.ts with new `estWorkerSalary` field.
"""

import csv
import re
import math
import os
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
EXT_DIR = os.path.join(ROOT_DIR, "src", "data", "Data for assignment", "external")
STATION_FILE = os.path.join(ROOT_DIR, "src", "data", "station-data.ts")

EARTH_RADIUS_KM = 6371.0


def haversine(lat1, lon1, lat2, lon2):
    """Great-circle distance in km."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def load_msoa_centroids():
    """Load MSOA population-weighted centroids (WGS84)."""
    path = os.path.join(EXT_DIR, "msoa-centroids.csv")
    centroids = {}
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row["MSOA21CD"].strip()
            lon = float(row["X"].strip())
            lat = float(row["Y"].strip())
            centroids[code] = (lat, lon)
    print(f"  Loaded {len(centroids)} MSOA centroids")
    return centroids


def load_msoa_to_la():
    """Load MSOA → Local Authority name mapping."""
    path = os.path.join(EXT_DIR, "msoa-names-lad.csv")
    mapping = {}
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row["msoa21cd"].strip()
            la_name = row["localauthorityname"].strip()
            mapping[code] = la_name
    print(f"  Loaded {len(mapping)} MSOA → LA mappings")
    return mapping


def compute_la_centroids(msoa_centroids, msoa_to_la):
    """Compute LA centroids as average of their MSOA centroids."""
    la_coords = defaultdict(list)
    for msoa_code, (lat, lon) in msoa_centroids.items():
        la_name = msoa_to_la.get(msoa_code)
        if la_name:
            la_coords[la_name].append((lat, lon))

    la_centroids = {}
    for la_name, coords in la_coords.items():
        avg_lat = sum(c[0] for c in coords) / len(coords)
        avg_lon = sum(c[1] for c in coords) / len(coords)
        la_centroids[la_name] = (avg_lat, avg_lon)

    print(f"  Computed centroids for {len(la_centroids)} Local Authorities")
    return la_centroids


def load_employment_by_sic():
    """Load BRES employment counts by LA × SIC section (preferred over enterprise counts)."""
    bres_path = os.path.join(EXT_DIR, "bres-employment-la-sic.csv")
    fallback_path = os.path.join(EXT_DIR, "business-counts-la-sic.csv")

    # Prefer BRES (employee counts) over Business Counts (enterprise counts)
    path = bres_path if os.path.exists(bres_path) else fallback_path
    source = "BRES employees" if path == bres_path else "Business Counts enterprises"

    # LA name → { SIC letter → count }
    la_sic = defaultdict(dict)
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            la_name = row["GEOGRAPHY_NAME"].strip()
            industry = row["INDUSTRY_NAME"].strip()
            value = row["OBS_VALUE"].strip()
            if not value:
                continue
            # Extract SIC letter: "K : Financial and insurance activities" → "K"
            sic_letter = industry.split(":")[0].strip()
            la_sic[la_name][sic_letter] = int(float(value))
    print(f"  Loaded {source} for {len(la_sic)} Local Authorities")
    return la_sic


def load_ashe_pay():
    """Load ASHE median annual pay by SIC section."""
    path = os.path.join(EXT_DIR, "ashe-median-pay-by-sic.csv")
    pay = {}
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sic = row["sic_section"].strip()
            pay[sic] = int(row["median_annual_pay"].strip())
    print(f"  Loaded ASHE pay for {len(pay)} SIC sections")
    return pay


def compute_weighted_salary(sic_profile, ashe_pay):
    """Compute weighted average salary for an LA given its SIC profile."""
    total_businesses = 0
    weighted_sum = 0
    for sic_letter, count in sic_profile.items():
        median_pay = ashe_pay.get(sic_letter, 0)
        if median_pay > 0 and count > 0:
            weighted_sum += count * median_pay
            total_businesses += count
    if total_businesses == 0:
        return 0
    return round(weighted_sum / total_businesses)


def find_nearest_la(lat, lon, la_centroids):
    """Find the nearest Local Authority to a given point."""
    best_la = None
    best_dist = float("inf")
    # Bounding box pre-filter: ~50km max
    lat_tol = 0.5
    lon_tol = 0.8
    for la_name, (la_lat, la_lon) in la_centroids.items():
        if abs(la_lat - lat) > lat_tol or abs(la_lon - lon) > lon_tol:
            continue
        dist = haversine(lat, lon, la_lat, la_lon)
        if dist < best_dist:
            best_dist = dist
            best_la = la_name
    # If no match within bounding box, search all
    if best_la is None:
        for la_name, (la_lat, la_lon) in la_centroids.items():
            dist = haversine(lat, lon, la_lat, la_lon)
            if dist < best_dist:
                best_dist = dist
                best_la = la_name
    return best_la, best_dist


def match_la_names(business_la_names, centroid_la_names):
    """Build a fuzzy mapping between Business Counts LA names and centroid LA names."""
    # First try exact match
    mapping = {}
    unmatched_biz = set()
    for biz_name in business_la_names:
        if biz_name in centroid_la_names:
            mapping[biz_name] = biz_name
        else:
            unmatched_biz.add(biz_name)

    # Fuzzy: normalize and try again
    def normalize(name):
        return name.lower().replace(",", "").replace("'", "").replace("-", " ").strip()

    centroid_norm = {normalize(n): n for n in centroid_la_names}
    still_unmatched = set()
    for biz_name in unmatched_biz:
        norm = normalize(biz_name)
        if norm in centroid_norm:
            mapping[biz_name] = centroid_norm[norm]
        else:
            still_unmatched.add(biz_name)

    if still_unmatched:
        print(f"  WARNING: {len(still_unmatched)} LAs unmatched: {list(still_unmatched)[:5]}...")

    return mapping


def parse_stations(content):
    """Parse station records from TypeScript file."""
    pattern = re.compile(
        r"""\{\s*name:\s*'([^']+)',\s*lat:\s*([\d.-]+),\s*lon:\s*([\d.-]+),\s*"""
        r"""region:\s*'([^']+)',\s*annualEntries:\s*(\d+),\s*"""
        r"""qsrCount400m:\s*(\d+),\s*qsrCount800m:\s*(\d+),\s*qsrCount1500m:\s*(\d+),\s*"""
        r"""brandCounts800m:\s*(\{[^}]*\}),\s*"""
        r"""footfallRatio:\s*([\d.]+),\s*"""
        r"""busStopCount800m:\s*(\d+),\s*"""
        r"""workplacePop1500m:\s*(\d+)"""
        r"""(?:,\s*estWorkerSalary:\s*(\d+))?\s*\}"""
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
        })
    return stations


def generate_ts(stations):
    """Generate TypeScript file content."""
    lines = [
        '// UK rail station data enriched with QSR proximity, bus density, workplace population, and worker salary',
        '// Sources: ORR 2024-25, NaPTAN, Getplace brand data, Census 2021 WP001, NOMIS Business Counts 2024, ONS ASHE 2023',
        '// Generated by scripts/convert-stations.py + convert-bus-density.py + convert-workplace-pop.py + convert-worker-salary.py',
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
            f"estWorkerSalary: {s['estWorkerSalary']} }},"
        )

    lines.append('] as const')
    lines.append('')
    return '\n'.join(lines)


def main():
    print("=== Enriching station data with SIC-weighted worker salary estimates ===")
    print()

    # Load all data sources
    print("Loading data sources...")
    msoa_centroids = load_msoa_centroids()
    msoa_to_la = load_msoa_to_la()
    la_centroids = compute_la_centroids(msoa_centroids, msoa_to_la)
    la_sic = load_employment_by_sic()
    ashe_pay = load_ashe_pay()

    # Match LA names between datasets
    print("\nMatching LA names between Business Counts and centroid datasets...")
    la_name_map = match_la_names(la_sic.keys(), la_centroids.keys())
    print(f"  Matched {len(la_name_map)} of {len(la_sic)} LAs")

    # Pre-compute salary for each LA
    print("\nComputing weighted salaries per LA...")
    la_salary = {}
    for biz_name, sic_profile in la_sic.items():
        salary = compute_weighted_salary(sic_profile, ashe_pay)
        centroid_name = la_name_map.get(biz_name, biz_name)
        la_salary[centroid_name] = salary

    salaries = [s for s in la_salary.values() if s > 0]
    if salaries:
        print(f"  Range: £{min(salaries):,} – £{max(salaries):,}")
        print(f"  Median: £{sorted(salaries)[len(salaries)//2]:,}")

    # Show top and bottom 5
    sorted_las = sorted(la_salary.items(), key=lambda x: x[1], reverse=True)
    print("\n  Top 5 LAs by estimated worker salary:")
    for name, sal in sorted_las[:5]:
        print(f"    {name}: £{sal:,}")
    print("  Bottom 5:")
    for name, sal in sorted_las[-5:]:
        print(f"    {name}: £{sal:,}")

    # Parse stations
    print(f"\nParsing stations from {STATION_FILE}...")
    with open(STATION_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    stations = parse_stations(content)
    print(f"  Parsed {len(stations)} stations")

    # Match each station to nearest LA and assign salary
    print("\nAssigning worker salary estimates to stations...")
    matched = 0
    for i, s in enumerate(stations):
        la_name, dist = find_nearest_la(s["lat"], s["lon"], la_centroids)
        salary = la_salary.get(la_name, 0)
        s["estWorkerSalary"] = salary
        if salary > 0:
            matched += 1
        if (i + 1) % 500 == 0:
            print(f"  Processed {i + 1}/{len(stations)} stations...")

    print(f"\n  Stations with salary estimate: {matched}/{len(stations)}")

    # Show some key stations
    key_names = [
        "London Liverpool Street", "Canada Water", "Bond Street",
        "Manchester Piccadilly", "Bristol Temple Meads", "Oxford"
    ]
    print("\n  Key stations:")
    for name in key_names:
        station = next((s for s in stations if s["name"] == name), None)
        if station:
            print(f"    {name}: £{station['estWorkerSalary']:,}")

    # Write output
    print(f"\nWriting enriched data to {STATION_FILE}...")
    output = generate_ts(stations)
    with open(STATION_FILE, "w", encoding="utf-8") as f:
        f.write(output)
    print(f"  Written {len(stations)} stations with estWorkerSalary field")
    print("\n=== Done ===")


if __name__ == "__main__":
    main()
