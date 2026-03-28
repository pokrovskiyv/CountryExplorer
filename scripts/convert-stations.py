#!/usr/bin/env python3
"""
Convert ORR station usage + NaPTAN coordinates into station-data.ts
with precomputed QSR proximity metrics per station.

Inputs:
  - ORR station usage CSV (entries/exits by station)
  - NaPTAN CSV (lat/lon for rail stations)
  - UK regions GeoJSON (for point-in-polygon)
  - Brand points GeoJSON (for proximity counting)

Output: src/data/station-data.ts
"""

import csv
import json
import math
import os
import re
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import shape, Point

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "src" / "data" / "Data for assignment"
EXT_DIR = DATA_DIR / "external"
OUT_DIR = ROOT / "src" / "data"

# ---------------------------------------------------------------------------
# 1. Load UK regions for point-in-polygon
# ---------------------------------------------------------------------------

REGIONS_FILE = DATA_DIR / "UK regions_ITL1_JAN_2025_UK_BGC_-4679820259920251378.geojson"


def load_regions():
    with open(REGIONS_FILE) as f:
        data = json.load(f)
    regions = []
    for feat in data["features"]:
        name = feat["properties"]["ITL125NM"]
        geom = shape(feat["geometry"])
        regions.append((name, geom))
    return regions


REGIONS = load_regions()


def point_to_region(lon, lat):
    pt = Point(lon, lat)
    for name, geom in REGIONS:
        if geom.contains(pt):
            return name
    # Fallback: nearest region
    best_name, best_dist = None, float("inf")
    for name, geom in REGIONS:
        d = geom.distance(pt)
        if d < best_dist:
            best_dist = d
            best_name = name
    return best_name


# ---------------------------------------------------------------------------
# 2. Haversine distance
# ---------------------------------------------------------------------------

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# 3. Load brand restaurant points
# ---------------------------------------------------------------------------

BRAND_FILES = {
    "Subway": "subway_uk_locations_2025_12_30.geojson",
    "McDonalds": "mcdonalds_uk_locations.geojson",
    "Dominos": "dominos_uk_locations.geojson",
    "KFC": "kfc_uk_locations.geojson",
    "Nandos": "nandos_uk_locations_detailed.geojson",
    "PapaJohns": "papajohns_uk_locations.geojson",
}


def load_all_restaurant_points():
    """Load all restaurant coordinates as (lat, lon, brand) tuples."""
    points = []
    for brand, filename in BRAND_FILES.items():
        filepath = DATA_DIR / filename
        if not filepath.exists():
            print(f"  WARNING: {filename} not found, skipping {brand}")
            continue
        with open(filepath) as f:
            data = json.load(f)
        for feat in data["features"]:
            coords = feat["geometry"]["coordinates"]
            lon, lat = coords[0], coords[1]
            points.append((lat, lon, brand))
    return points


def count_qsr_near_station(station_lat, station_lon, restaurant_points, radius_km):
    """Count total QSR and per-brand breakdown within radius of a station."""
    total = 0
    brand_counts = {}
    # Bounding box pre-filter (approx)
    lat_tol = radius_km / 111.0
    lon_tol = radius_km / (111.0 * math.cos(math.radians(station_lat)))

    for lat, lon, brand in restaurant_points:
        if abs(lat - station_lat) > lat_tol or abs(lon - station_lon) > lon_tol:
            continue
        if haversine_km(station_lat, station_lon, lat, lon) <= radius_km:
            total += 1
            brand_counts[brand] = brand_counts.get(brand, 0) + 1

    return total, brand_counts


# ---------------------------------------------------------------------------
# 4. Load NaPTAN data (rail station coordinates)
# ---------------------------------------------------------------------------

def load_naptan_stations():
    """Load rail station coordinates from NaPTAN CSV."""
    naptan_file = EXT_DIR / "naptan-stops.csv"
    if not naptan_file.exists():
        print(f"ERROR: {naptan_file} not found. Run download-external-data.sh first.")
        sys.exit(1)

    stations = {}  # station name (normalized) -> (lat, lon)

    with open(naptan_file, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            stop_type = row.get("StopType", "")
            # RLY = railway station entrance, RSE = rail platform
            if stop_type not in ("RLY", "RSE"):
                continue

            name = row.get("CommonName", "").strip()
            lat_str = row.get("Latitude", "")
            lon_str = row.get("Longitude", "")

            if not lat_str or not lon_str or not name:
                continue

            try:
                lat = float(lat_str)
                lon = float(lon_str)
            except ValueError:
                continue

            # Normalize: remove "Rail Station", "Railway Station", etc.
            norm_name = normalize_station_name(name)
            # Keep first occurrence (avoid duplicates from multiple entrances)
            if norm_name not in stations:
                stations[norm_name] = (lat, lon)
            # Also index by fuzzy keys for better matching
            fk = fuzzy_key(norm_name)
            if fk not in stations:
                stations[fk] = (lat, lon)
            fkf = fuzzy_key_flat(norm_name)
            if fkf not in stations:
                stations[fkf] = (lat, lon)

    return stations


def normalize_station_name(name):
    """Normalize station name for matching between ORR and NaPTAN."""
    name = name.strip()
    # Remove common suffixes
    for suffix in [" Rail Station", " Railway Station", " Station", " Rail"]:
        if name.endswith(suffix):
            name = name[: -len(suffix)]
    return name.strip()


def fuzzy_key(name):
    """Create a fuzzy matching key: lowercase, no punctuation, normalized words.
    Removes parenthetical qualifiers entirely."""
    s = name.lower().strip()
    # Remove notes like "[note 1]"
    s = re.sub(r"\[.*?\]", "", s)
    # Remove parenthetical qualifiers
    s = re.sub(r"\s*\(.*?\)\s*", " ", s)
    # Normalize "and" / "&"
    s = s.replace(" & ", " and ").replace("&", " and ")
    # Remove apostrophes
    s = s.replace("'", "").replace("\u2019", "")
    # Replace hyphens with spaces
    s = s.replace("-", " ")
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s


def fuzzy_key_flat(name):
    """Like fuzzy_key but flattens parens instead of removing content.
    'Queens Road (Peckham)' → 'queens road peckham'"""
    s = name.lower().strip()
    s = re.sub(r"\[.*?\]", "", s)
    s = s.replace("(", " ").replace(")", " ")
    s = s.replace(" & ", " and ").replace("&", " and ")
    s = s.replace("'", "").replace("\u2019", "")
    s = s.replace("-", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


# ---------------------------------------------------------------------------
# 5. Load ORR station usage data
# ---------------------------------------------------------------------------

def load_orr_usage():
    """Load ORR station usage CSV. Returns dict: station_name -> annual_entries.

    The ORR CSV has 3 metadata rows before the actual header row.
    Column names contain newlines (multi-line headers in the spreadsheet).
    Numbers are comma-formatted (e.g., '11,873,686').
    """
    orr_file = EXT_DIR / "orr-station-usage.csv"
    if not orr_file.exists():
        print(f"ERROR: {orr_file} not found. Run download-external-data.sh first.")
        sys.exit(1)

    stations = {}  # normalized name -> {name, tlc, entries, region_orr}

    with open(orr_file, encoding="utf-8-sig") as f:
        # Skip 3 metadata rows
        for _ in range(3):
            next(f)

        reader = csv.DictReader(f)
        headers = reader.fieldnames
        if not headers:
            print("ERROR: ORR CSV appears empty after skipping metadata rows")
            sys.exit(1)

        # Find key columns by substring matching (handles newlines in names)
        entries_col = None
        tlc_col = None
        region_col = None
        name_col = None

        for h in headers:
            h_clean = h.replace("\n", " ").lower().strip()
            if "all tickets" in h_clean:
                entries_col = h
            elif "three letter" in h_clean or "tlc" in h_clean:
                tlc_col = h
            elif h_clean == "region":
                region_col = h
            elif "station name" in h_clean:
                name_col = h

        if not entries_col:
            # Fallback: any column with "entries" and "all"
            for h in headers:
                if "entries" in h.lower() and "all" in h.lower():
                    entries_col = h
                    break

        if not name_col:
            name_col = headers[0]  # First column is station name

        print(f"  Columns: name='{name_col}', entries='{entries_col}', "
              f"tlc='{tlc_col}', region='{region_col}'")

        for row in reader:
            name = row.get(name_col, "").strip()
            if not name:
                continue

            entries_str = row.get(entries_col, "0") if entries_col else "0"
            # Clean number: remove commas, spaces, newlines
            entries_str = re.sub(r"[,\s\n]", "", entries_str)
            # Handle "[z]" (data not applicable) entries
            if "[" in entries_str or not entries_str:
                entries_str = "0"
            try:
                entries = float(entries_str)
            except ValueError:
                entries = 0

            tlc = row.get(tlc_col, "").strip() if tlc_col else ""
            # TLC may also have newlines
            tlc = tlc.replace("\n", "").strip()
            region_orr = row.get(region_col, "").strip() if region_col else ""

            norm_name = normalize_station_name(name)
            stations[norm_name] = {
                "name": name,
                "tlc": tlc,
                "entries": entries,
                "region_orr": region_orr,
            }

    return stations


# ---------------------------------------------------------------------------
# 6. Join ORR + NaPTAN + restaurants -> station-data.ts
# ---------------------------------------------------------------------------

def generate_station_data():
    print("Loading NaPTAN station coordinates...")
    naptan = load_naptan_stations()
    print(f"  Loaded {len(naptan)} rail station coordinates")

    print("Loading ORR station usage...")
    orr = load_orr_usage()
    print(f"  Loaded {len(orr)} stations with usage data")

    print("Loading restaurant points...")
    restaurants = load_all_restaurant_points()
    print(f"  Loaded {len(restaurants)} restaurant points")

    # Join ORR usage with NaPTAN coordinates using multi-level matching
    matched = []
    unmatched = []

    # Build reverse fuzzy indices
    naptan_fuzzy = {}
    for k, v in naptan.items():
        for fn in (fuzzy_key, fuzzy_key_flat):
            fk = fn(k)
            if fk not in naptan_fuzzy:
                naptan_fuzzy[fk] = v

    def try_match(name):
        """Try matching ORR name to NaPTAN using multiple strategies."""
        # 1. Exact normalized match
        if name in naptan:
            return naptan[name]
        # 2. Strip parenthetical
        alt = re.sub(r"\s*\(.*?\)\s*", "", name).strip()
        if alt in naptan:
            return naptan[alt]
        # 3. Fuzzy key match (and↔&, hyphens, apostrophes, case)
        fk = fuzzy_key(name)
        if fk in naptan_fuzzy:
            return naptan_fuzzy[fk]
        # 3b. Fuzzy key with parens flattened
        fkf = fuzzy_key_flat(name)
        if fkf in naptan_fuzzy:
            return naptan_fuzzy[fkf]
        # 4. Try adding "Central" (e.g., "Lincoln" → "Lincoln Central")
        if f"{fk} central" in naptan_fuzzy:
            return naptan_fuzzy[f"{fk} central"]
        # 5. Try first N words (e.g., "Chafford Hundred Lakeside" → "Chafford Hundred")
        words = fk.split()
        for n in range(len(words) - 1, 0, -1):
            partial = " ".join(words[:n])
            if partial in naptan_fuzzy:
                return naptan_fuzzy[partial]
        # 6. Try replacing parenthetical content differently
        #    "Kensington Olympia" → "Kensington (Olympia)"
        if len(words) >= 2:
            alt_paren = f"{words[0]} ({' '.join(words[1:])})"
            if alt_paren in naptan:
                return naptan[alt_paren]
            # "Newark Northgate" → "Newark North Gate"
            spaced = fk.replace("north", "north ").replace("south", "south ")
            spaced = re.sub(r"\s+", " ", spaced).strip()
            if spaced != fk and spaced in naptan_fuzzy:
                return naptan_fuzzy[spaced]
        return None

    for norm_name, orr_data in orr.items():
        coords = try_match(norm_name)
        if coords:
            lat, lon = coords
            matched.append({
                "name": orr_data["name"],
                "lat": lat,
                "lon": lon,
                "entries": orr_data["entries"],
                "tlc": orr_data["tlc"],
            })
        else:
            unmatched.append((norm_name, orr_data["entries"]))

    # Sort unmatched by traffic for reporting
    unmatched.sort(key=lambda x: -x[1])

    print(f"\n  Matched: {len(matched)} stations")
    print(f"  Unmatched: {len(unmatched)} stations")
    if unmatched:
        top_unmatched = [(n, e) for n, e in unmatched[:10] if e >= 10_000]
        if top_unmatched:
            print(f"  Top unmatched (>10K entries):")
            for name, entries in top_unmatched:
                print(f"    {entries:>12,.0f}  {name}")

    # Filter to stations with meaningful traffic
    MIN_ENTRIES = 10_000  # At least 10K annual entries to be relevant
    relevant = [s for s in matched if s["entries"] >= MIN_ENTRIES]
    relevant.sort(key=lambda s: s["entries"], reverse=True)
    print(f"  Relevant stations (>={MIN_ENTRIES:,} entries): {len(relevant)}")

    # Compute QSR proximity for each station
    print("\nComputing QSR proximity (this may take a minute)...")
    station_records = []
    all_brands = list(BRAND_FILES.keys())

    for i, station in enumerate(relevant):
        if (i + 1) % 100 == 0:
            print(f"  Processing station {i + 1}/{len(relevant)}...")

        lat, lon = station["lat"], station["lon"]
        region = point_to_region(lon, lat)

        # Count QSR at different radii
        qsr_400m, _ = count_qsr_near_station(lat, lon, restaurants, 0.4)
        qsr_800m, brands_800m = count_qsr_near_station(lat, lon, restaurants, 0.8)
        qsr_1500m, _ = count_qsr_near_station(lat, lon, restaurants, 1.5)

        # Footfall ratio: entries per QSR within 800m (higher = more underserved)
        footfall_ratio = station["entries"] / max(qsr_800m, 1)

        station_records.append({
            "name": station["name"],
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "region": region,
            "annualEntries": round(station["entries"]),
            "qsrCount400m": qsr_400m,
            "qsrCount800m": qsr_800m,
            "qsrCount1500m": qsr_1500m,
            "brandCounts800m": {b: brands_800m.get(b, 0) for b in all_brands},
            "footfallRatio": round(footfall_ratio),
        })

    # Generate TypeScript
    print(f"\nGenerating station-data.ts ({len(station_records)} stations)...")
    generate_ts(station_records, all_brands)
    print("Done!")


def escape_ts_string(s):
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", "")


def generate_ts(records, all_brands):
    lines = []
    lines.append("// UK rail station data with QSR proximity metrics")
    lines.append("// Sources: ORR Station Usage (OGL v3.0) + NaPTAN (OGL v3.0)")
    lines.append("// Generated by scripts/convert-stations.py")
    lines.append("")
    lines.append("export interface StationRecord {")
    lines.append("  readonly name: string")
    lines.append("  readonly lat: number")
    lines.append("  readonly lon: number")
    lines.append("  readonly region: string")
    lines.append("  readonly annualEntries: number")
    lines.append("  readonly qsrCount400m: number")
    lines.append("  readonly qsrCount800m: number")
    lines.append("  readonly qsrCount1500m: number")
    lines.append("  readonly brandCounts800m: Readonly<Record<string, number>>")
    lines.append("  readonly footfallRatio: number")
    lines.append("}")
    lines.append("")
    lines.append("export const STATION_DATA: readonly StationRecord[] = [")

    for rec in records:
        brand_parts = ", ".join(
            f"{b}: {rec['brandCounts800m'].get(b, 0)}" for b in all_brands
        )
        name_esc = escape_ts_string(rec["name"])
        region_esc = escape_ts_string(rec["region"])
        lines.append(
            f"  {{ name: '{name_esc}', lat: {rec['lat']}, lon: {rec['lon']}, "
            f"region: '{region_esc}', annualEntries: {rec['annualEntries']}, "
            f"qsrCount400m: {rec['qsrCount400m']}, qsrCount800m: {rec['qsrCount800m']}, "
            f"qsrCount1500m: {rec['qsrCount1500m']}, "
            f"brandCounts800m: {{ {brand_parts} }}, "
            f"footfallRatio: {rec['footfallRatio']} }},"
        )

    lines.append("] as const")
    lines.append("")

    out_path = OUT_DIR / "station-data.ts"
    with open(out_path, "w") as f:
        f.write("\n".join(lines))
    print(f"  Written {out_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    generate_station_data()
