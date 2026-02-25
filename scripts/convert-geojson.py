#!/usr/bin/env python3
"""
Convert real GeoJSON restaurant data into brand-points.ts, city-region-mapping.ts,
and update REGION_COUNTS in uk-data.ts.

Uses point-in-polygon with UK regions GeoJSON for region assignment.
"""

import json
import os
import re
from pathlib import Path
from shapely.geometry import shape, Point

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "src" / "data" / "Data for assignment"
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
    # Fallback: nearest region by distance
    best_name, best_dist = None, float("inf")
    for name, geom in REGIONS:
        d = geom.distance(pt)
        if d < best_dist:
            best_dist = d
            best_name = name
    return best_name

# ---------------------------------------------------------------------------
# 2. Brand-specific extractors
# ---------------------------------------------------------------------------

def extract_kfc(feat):
    props = feat["properties"]
    name = props.get("name", "")
    # Filter test entries
    if name.startswith("LAB_"):
        return None
    coords = feat["geometry"]["coordinates"]
    lon, lat = coords[0], coords[1]
    street = props.get("street", "")
    city = props.get("city", "")
    postcode = props.get("postalcode", "")
    address = street if street else name
    return (lat, lon, address, city, postcode)

def extract_mcdonalds(feat):
    props = feat["properties"]
    coords = feat["geometry"]["coordinates"]
    lon, lat = coords[0], coords[1]
    name = props.get("name", "")
    address = props.get("customAddress") or props.get("address", "")
    city = props.get("city", "")
    postcode = props.get("postcode", "")
    if not address or address == city:
        address = name
    return (lat, lon, address, city, postcode)

def extract_nandos(feat):
    props = feat["properties"]
    coords = feat["geometry"]["coordinates"]
    lon, lat = coords[0], coords[1]
    name = props.get("name", "")
    addr_obj = props.get("address", {})
    street = addr_obj.get("streetAddress", "")
    locality = addr_obj.get("addressLocality", "")
    postcode = addr_obj.get("postalCode", "")
    # addressLocality often has "Borough, London" - extract city
    city = locality.split(",")[-1].strip() if locality else ""
    address = street.strip().strip(",").strip() if street else name
    return (lat, lon, address, city, postcode)

def extract_dominos(feat):
    props = feat["properties"]
    coords = feat["geometry"]["coordinates"]
    lon, lat = coords[0], coords[1]
    name = props.get("name", "")
    loc = props.get("location", {})
    addr_obj = loc.get("address", {})
    line1 = addr_obj.get("line1", "")
    town = addr_obj.get("town", "")
    postcode = addr_obj.get("postcode", "")
    address = line1 if line1 else name
    city = town if town else name
    return (lat, lon, address, city, postcode)

def extract_papajohns(feat):
    props = feat["properties"]
    coords = feat["geometry"]["coordinates"]
    lon, lat = coords[0], coords[1]
    name = props.get("name", "")
    street = props.get("street", "")
    town = props.get("town", "")
    postcode = props.get("postcode", "")
    address = street if street else name
    city = town if town else name
    return (lat, lon, address, city, postcode)

def extract_subway(feat):
    props = feat["properties"]
    coords = feat["geometry"]["coordinates"]
    lon, lat = coords[0], coords[1]
    name = props.get("name", "")
    address1 = props.get("address1", "")
    city = props.get("city", "")
    postcode = props.get("postcode", "")
    address = address1 if address1 else name
    return (lat, lon, address, city, postcode)

# ---------------------------------------------------------------------------
# 3. Read all brands
# ---------------------------------------------------------------------------

BRAND_FILES = {
    "Subway": ("subway_uk_locations_2025_12_30.geojson", extract_subway),
    "McDonalds": ("mcdonalds_uk_locations.geojson", extract_mcdonalds),
    "Dominos": ("dominos_uk_locations.geojson", extract_dominos),
    "KFC": ("kfc_uk_locations.geojson", extract_kfc),
    "Nandos": ("nandos_uk_locations_detailed.geojson", extract_nandos),
    "PapaJohns": ("papajohns_uk_locations.geojson", extract_papajohns),
}

def load_brand(filename, extractor):
    filepath = DATA_DIR / filename
    with open(filepath) as f:
        data = json.load(f)
    points = []
    for feat in data["features"]:
        result = extractor(feat)
        if result is not None:
            lat, lon, address, city, postcode = result
            points.append((lat, lon, address, normalize_city(city), postcode))
    return points

def escape_ts_string(s):
    """Escape string for TypeScript single-quoted string literal."""
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", "")

def normalize_city(city):
    """Normalize city name to consistent title case.

    Handles ALL CAPS from McDonald's/KFC, lowercase, and mixed forms.
    Preserves known compound names (e.g. 'upon', 'on', 'le').
    """
    if not city:
        return city
    city = city.strip()
    # Title-case, then fix small words
    words = city.title().split()
    small_words = {"Upon", "On", "Le", "In", "Of", "The", "And", "De", "By", "Under", "Super", "Sub"}
    result = []
    for i, w in enumerate(words):
        if i > 0 and w in small_words:
            result.append(w.lower())
        else:
            result.append(w)
    return " ".join(result)

# ---------------------------------------------------------------------------
# 4. Generate brand-points.ts
# ---------------------------------------------------------------------------

def generate_brand_points_ts(all_brands):
    lines = []
    lines.append("// Real restaurant location data extracted from brand GeoJSON files")
    lines.append("// Source: src/data/Data for assignment/*.geojson")
    lines.append("// Format: [lat, lng, address, city, postcode]")
    lines.append("")
    lines.append("type BrandPoint = [number, number, string, string, string];")
    lines.append("")
    lines.append("export const BRAND_POINTS: Record<string, BrandPoint[]> = {")

    for brand_name in ["Subway", "McDonalds", "Dominos", "KFC", "Nandos", "PapaJohns"]:
        points = all_brands[brand_name]
        lines.append(f"  {brand_name}: [")
        for lat, lon, address, city, postcode in points:
            addr_esc = escape_ts_string(address)
            city_esc = escape_ts_string(city)
            pc_esc = escape_ts_string(postcode)
            lines.append(f"    [{lat},{lon},'{addr_esc}','{city_esc}','{pc_esc}'],")
        lines.append("  ],")

    lines.append("};")
    lines.append("")

    out_path = OUT_DIR / "brand-points.ts"
    with open(out_path, "w") as f:
        f.write("\n".join(lines))
    print(f"Written {out_path} ({sum(len(v) for v in all_brands.values())} points)")

# ---------------------------------------------------------------------------
# 5. Generate city-region-mapping.ts and REGION_COUNTS
# ---------------------------------------------------------------------------

def generate_city_region_and_counts(all_brands):
    # Assign each point to a region
    city_region = {}  # city -> region
    region_brand_counts = {}  # region -> brand -> count

    for region_name, _ in REGIONS:
        region_brand_counts[region_name] = {b: 0 for b in BRAND_FILES}
        region_brand_counts[region_name]["total"] = 0

    unassigned = 0
    for brand_name, points in all_brands.items():
        for lat, lon, address, city, postcode in points:
            region = point_to_region(lon, lat)
            if region is None:
                unassigned += 1
                continue

            region_brand_counts[region][brand_name] += 1
            region_brand_counts[region]["total"] += 1

            # Map city to region (first assignment wins, most points determine)
            if city and city not in city_region:
                city_region[city] = region

    if unassigned:
        print(f"WARNING: {unassigned} points could not be assigned to a region")

    # --- city-region-mapping.ts ---
    lines = []
    lines.append("// Maps city/town name -> UK region")
    lines.append("// Generated from real GeoJSON restaurant data via point-in-polygon")
    lines.append("")
    lines.append("export const CITY_TO_REGION: Record<string, string> = {")

    # Group by region for readability
    region_cities = {}
    for city, region in sorted(city_region.items()):
        region_cities.setdefault(region, []).append(city)

    region_order = [
        "North East (England)", "North West (England)", "Yorkshire and The Humber",
        "East Midlands (England)", "West Midlands (England)", "East (England)",
        "London", "South East (England)", "South West (England)",
        "Wales", "Scotland", "Northern Ireland",
    ]

    for region in region_order:
        cities = sorted(region_cities.get(region, []))
        if not cities:
            continue
        lines.append(f"  // {region}")
        for city in cities:
            city_esc = escape_ts_string(city)
            lines.append(f"  '{city_esc}': '{region}',")
        lines.append("")

    lines.append("};")
    lines.append("")

    out_path = OUT_DIR / "city-region-mapping.ts"
    with open(out_path, "w") as f:
        f.write("\n".join(lines))
    print(f"Written {out_path} ({len(city_region)} cities)")

    # --- Print REGION_COUNTS for uk-data.ts ---
    print("\n// REGION_COUNTS to paste into uk-data.ts:")
    print("export const REGION_COUNTS: Record<string, Record<string, number>> = {")
    for region in region_order:
        counts = region_brand_counts.get(region, {})
        parts = []
        for b in ["Subway", "McDonalds", "Dominos", "KFC", "Nandos", "PapaJohns"]:
            parts.append(f"{b}: {counts.get(b, 0)}")
        parts.append(f"total: {counts.get('total', 0)}")
        print(f'  "{region}": {{ {", ".join(parts)} }},')
    print("};")

    return region_brand_counts

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Loading brand data...")
    all_brands = {}
    for brand_name, (filename, extractor) in BRAND_FILES.items():
        points = load_brand(filename, extractor)
        all_brands[brand_name] = points
        print(f"  {brand_name}: {len(points)} points")

    print(f"\nTotal: {sum(len(v) for v in all_brands.values())} points")

    print("\nAssigning regions (point-in-polygon)...")
    region_counts = generate_city_region_and_counts(all_brands)

    print("\nGenerating brand-points.ts...")
    generate_brand_points_ts(all_brands)

    print("\nDone!")

if __name__ == "__main__":
    main()
