#!/usr/bin/env python3
"""
Convert DfT Annual Average Daily Flow (AADF) traffic counts into traffic-data.ts.
Focuses on high-traffic road points and their proximity to drive-thru QSR.

Input: DfT AADF CSV + count_points CSV
Output: src/data/traffic-data.ts
"""

import csv
import json
import math
import sys
from pathlib import Path

from shapely.geometry import shape, Point

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "src" / "data" / "Data for assignment"
EXT_DIR = DATA_DIR / "external"
OUT_DIR = ROOT / "src" / "data"

# ---------------------------------------------------------------------------
# 1. Load UK regions
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
    best_name, best_dist = None, float("inf")
    for name, geom in REGIONS:
        d = geom.distance(pt)
        if d < best_dist:
            best_dist = d
            best_name = name
    return best_name


# ---------------------------------------------------------------------------
# 2. Haversine + proximity
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
# 3. Load drive-thru restaurant data
# ---------------------------------------------------------------------------

def load_drive_thru_points():
    """Load only drive-thru enabled restaurant coordinates."""
    # We need to cross-reference brand-points with brand-attributes
    # to find drive-thru locations. For simplicity, load from GeoJSON
    # and check properties directly.
    drive_thru_points = []

    # KFC: hasDriveThru property
    kfc_file = DATA_DIR / "kfc_uk_locations.geojson"
    if kfc_file.exists():
        with open(kfc_file) as f:
            data = json.load(f)
        for feat in data["features"]:
            props = feat["properties"]
            if props.get("hasDriveThru"):
                coords = feat["geometry"]["coordinates"]
                drive_thru_points.append((coords[1], coords[0], "KFC"))

    # McDonald's: "DRIVETHRU" in features
    mcd_file = DATA_DIR / "mcdonalds_uk_locations.geojson"
    if mcd_file.exists():
        with open(mcd_file) as f:
            data = json.load(f)
        for feat in data["features"]:
            features = feat["properties"].get("features", []) or []
            if "DRIVETHRU" in features:
                coords = feat["geometry"]["coordinates"]
                drive_thru_points.append((coords[1], coords[0], "McDonalds"))

    return drive_thru_points


def load_all_restaurant_points():
    """Load all restaurant coordinates as (lat, lon, brand) tuples."""
    brand_files = {
        "Subway": "subway_uk_locations_2025_12_30.geojson",
        "McDonalds": "mcdonalds_uk_locations.geojson",
        "Dominos": "dominos_uk_locations.geojson",
        "KFC": "kfc_uk_locations.geojson",
        "Nandos": "nandos_uk_locations_detailed.geojson",
        "PapaJohns": "papajohns_uk_locations.geojson",
    }
    points = []
    for brand, filename in brand_files.items():
        filepath = DATA_DIR / filename
        if not filepath.exists():
            continue
        with open(filepath) as f:
            data = json.load(f)
        for feat in data["features"]:
            coords = feat["geometry"]["coordinates"]
            points.append((coords[1], coords[0], brand))
    return points


def count_nearby(center_lat, center_lon, points, radius_km):
    """Count points within radius."""
    lat_tol = radius_km / 111.0
    lon_tol = radius_km / (111.0 * math.cos(math.radians(center_lat)))
    count = 0
    for lat, lon, _brand in points:
        if abs(lat - center_lat) > lat_tol or abs(lon - center_lon) > lon_tol:
            continue
        if haversine_km(center_lat, center_lon, lat, lon) <= radius_km:
            count += 1
    return count


# ---------------------------------------------------------------------------
# 4. Load DfT data
# ---------------------------------------------------------------------------

def load_dft_data():
    """Load DfT AADF and count point data."""
    # Try to find the AADF file
    aadf_file = None
    for name in ["dft_traffic_counts_aadf.csv", "dft_aadf.csv"]:
        candidate = EXT_DIR / name
        if candidate.exists():
            aadf_file = candidate
            break

    if aadf_file is None:
        # Check if there's a nested directory from unzip
        for f in EXT_DIR.glob("**/dft_traffic_counts_aadf*.csv"):
            aadf_file = f
            break

    if aadf_file is None:
        print("ERROR: AADF CSV not found in external data directory.")
        print(f"  Looked in: {EXT_DIR}")
        sys.exit(1)

    print(f"  Reading {aadf_file.name}...")

    # The AADF file has one row per count_point per year
    # We want the latest year for each count point
    count_points = {}  # count_point_id -> {lat, lon, aadf, road_name, road_type}

    with open(aadf_file, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames
        print(f"  AADF columns (first 10): {headers[:10]}")

        for row in reader:
            cp_id = row.get("count_point_id", row.get("Count_point_id", ""))
            year = int(row.get("year", row.get("Year", "0")))
            lat_str = row.get("latitude", row.get("Latitude", ""))
            lon_str = row.get("longitude", row.get("Longitude", ""))
            aadf_str = row.get("all_motor_vehicles", row.get("All_motor_vehicles", "0"))
            road_name = row.get("road_name", row.get("Road", ""))
            road_type = row.get("road_type", row.get("Road_type", ""))

            if not lat_str or not lon_str or not cp_id:
                continue

            try:
                lat = float(lat_str)
                lon = float(lon_str)
                aadf = int(aadf_str) if aadf_str else 0
            except (ValueError, TypeError):
                continue

            # Keep latest year for each count point
            existing = count_points.get(cp_id)
            if existing is None or year > existing.get("year", 0):
                count_points[cp_id] = {
                    "lat": lat,
                    "lon": lon,
                    "aadf": aadf,
                    "road_name": road_name,
                    "road_type": road_type,
                    "year": year,
                }

    return count_points


def generate_traffic_data():
    print("Loading DfT traffic count data...")
    count_points = load_dft_data()
    print(f"  Total count points: {len(count_points)}")

    # Filter to top N by traffic volume
    TOP_N = 5000
    sorted_points = sorted(count_points.values(), key=lambda x: x["aadf"], reverse=True)
    top_points = sorted_points[:TOP_N]
    print(f"  Filtered to top {TOP_N} by AADF")
    print(f"  AADF range: {top_points[-1]['aadf']:,} - {top_points[0]['aadf']:,}")

    print("Loading drive-thru restaurant points...")
    drive_thru = load_drive_thru_points()
    print(f"  Drive-thru locations: {len(drive_thru)}")

    print("Loading all restaurant points...")
    all_restaurants = load_all_restaurant_points()
    print(f"  All restaurant locations: {len(all_restaurants)}")

    print("Computing proximity metrics (this may take a few minutes)...")
    traffic_records = []

    for i, point in enumerate(top_points):
        if (i + 1) % 500 == 0:
            print(f"  Processing point {i + 1}/{TOP_N}...")

        lat, lon = point["lat"], point["lon"]
        region = point_to_region(lon, lat)

        dt_count = count_nearby(lat, lon, drive_thru, 1.5)
        qsr_count = count_nearby(lat, lon, all_restaurants, 1.5)

        traffic_records.append({
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "region": region,
            "roadName": point["road_name"],
            "roadType": point["road_type"],
            "aadf": point["aadf"],
            "driveThruCount1500m": dt_count,
            "qsrCount1500m": qsr_count,
        })

    # Generate TypeScript
    print(f"\nGenerating traffic-data.ts ({len(traffic_records)} points)...")
    generate_ts(traffic_records)
    print("Done!")


def escape_ts_string(s):
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", "")


def generate_ts(records):
    lines = []
    lines.append("// UK road traffic count data with QSR proximity metrics")
    lines.append("// Source: DfT Annual Average Daily Flow (OGL v3.0)")
    lines.append("// Generated by scripts/convert-traffic.py")
    lines.append("")
    lines.append("export interface TrafficPoint {")
    lines.append("  readonly lat: number")
    lines.append("  readonly lon: number")
    lines.append("  readonly region: string")
    lines.append("  readonly roadName: string")
    lines.append("  readonly roadType: string")
    lines.append("  readonly aadf: number")
    lines.append("  readonly driveThruCount1500m: number")
    lines.append("  readonly qsrCount1500m: number")
    lines.append("}")
    lines.append("")
    lines.append("export const TRAFFIC_DATA: readonly TrafficPoint[] = [")

    for rec in records:
        road_esc = escape_ts_string(rec["roadName"])
        type_esc = escape_ts_string(rec["roadType"])
        region_esc = escape_ts_string(rec["region"])
        lines.append(
            f"  {{ lat: {rec['lat']}, lon: {rec['lon']}, "
            f"region: '{region_esc}', roadName: '{road_esc}', "
            f"roadType: '{type_esc}', aadf: {rec['aadf']}, "
            f"driveThruCount1500m: {rec['driveThruCount1500m']}, "
            f"qsrCount1500m: {rec['qsrCount1500m']} }},"
        )

    lines.append("] as const")
    lines.append("")

    out_path = OUT_DIR / "traffic-data.ts"
    with open(out_path, "w") as f:
        f.write("\n".join(lines))
    print(f"  Written {out_path}")


if __name__ == "__main__":
    generate_traffic_data()
