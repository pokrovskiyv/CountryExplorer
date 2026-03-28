#!/usr/bin/env python3
"""
Aggregate LSOA-level income deprivation rates to MSOA polygons and output TopoJSON.

Pipeline:
  1. Load MSOA boundary polygons (7,264 MSOAs, England & Wales)
  2. Load LSOA centroids + IMD/WIMD income deprivation rates
  3. Assign each LSOA to its containing MSOA via spatial index (STRtree)
  4. Compute mean income deprivation rate per MSOA
  5. Assign UK-wide deciles (1-10)
  6. Output GeoJSON with scores, then convert to TopoJSON via geo2topo

Sources:
  - MSOA boundaries: ONS Open Geography Portal (BGC Dec 2021 V3)
  - IMD 2025 File 7: England (33,756 LSOAs) — "Income Score (rate)" column
  - WIMD 2025: Wales (1,917 LSOAs) — "Income" column (inverted to match England scale)

Output: public/msoa-income-topo.json
"""

import csv
import json
import os
import subprocess

from shapely.geometry import Point, shape
from shapely import STRtree

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
EXT_DIR = os.path.join(ROOT_DIR, "src", "data", "Data for assignment", "external")
MSOA_GEOJSON = os.path.join(EXT_DIR, "msoa-boundaries-bgc.geojson")
TMP_GEOJSON = os.path.join(ROOT_DIR, "public", "_msoa-income-tmp.geojson")
OUT_TOPO = os.path.join(ROOT_DIR, "public", "msoa-income-topo.json")


def load_msoa_boundaries():
    """Load MSOA boundary polygons. Returns list of (code, name, shapely_geom, geojson_geom)."""
    print("Loading MSOA boundaries...")
    with open(MSOA_GEOJSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data["features"]
    result = []
    for feat in features:
        props = feat["properties"]
        code = props.get("MSOA21CD", "")
        name = props.get("MSOA21NM", "")
        geom = shape(feat["geometry"])
        result.append((code, name, geom, feat["geometry"]))

    print(f"  Loaded {len(result)} MSOA polygons")
    return result


def load_lsoa_centroids():
    """Load LSOA centroids for England & Wales. Returns {code: (lat, lon)}."""
    path = os.path.join(EXT_DIR, "lsoa-centroids-2021.csv")
    centroids = {}
    with open(path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            code = row["LSOA21CD"].strip()
            centroids[code] = (float(row["lat"]), float(row["lon"]))
    print(f"  LSOA centroids: {len(centroids)}")
    return centroids


def load_england_income_rates():
    """Load IMD 2025 income deprivation rates for England.
    Returns {lsoa_code: rate} where rate is 0-1 (higher = more deprived).
    """
    import pandas as pd

    path = os.path.join(EXT_DIR, "imd-2025-file7.csv")
    df = pd.read_csv(path, encoding="utf-8-sig")
    rates = {}
    for _, row in df.iterrows():
        code = str(row["LSOA code (2021)"]).strip()
        rate = float(row["Income Score (rate)"])
        rates[code] = rate
    print(f"  England income rates: {len(rates)}")
    return rates


def load_wales_income_rates():
    """Load WIMD 2025 income scores for Wales, inverted to 0-1 deprivation rate.
    WIMD Income is 0-100 where higher = less deprived, so invert: rate = (100 - score) / 100.
    """
    import pandas as pd

    path = os.path.join(EXT_DIR, "wimd-2025-scores.ods")
    if not os.path.exists(path):
        print("  WARNING: WIMD file not found, skipping Wales")
        return {}

    df = pd.read_excel(path, engine="odf", sheet_name="Data", skiprows=3)
    df.columns = [str(c).strip() for c in df.columns]

    # Find the Income column
    income_col = None
    for c in df.columns:
        if c.strip().lower() == "income":
            income_col = c
            break
    if not income_col:
        print("  WARNING: Cannot find Income column, skipping Wales")
        return {}

    # Find the LSOA code column
    code_col = None
    for c in df.columns:
        if "lsoa" in c.lower() and "code" in c.lower():
            code_col = c
            break
    if not code_col:
        code_col = df.columns[0]

    rates = {}
    for _, row in df.iterrows():
        code_val = row[code_col]
        score_val = row[income_col]
        if pd.isna(code_val) or pd.isna(score_val):
            continue
        # Invert: WIMD Income higher = less deprived → rate = (100 - score) / 100
        rate = (100.0 - float(score_val)) / 100.0
        rates[str(code_val).strip()] = rate

    print(f"  Wales income rates: {len(rates)}")
    return rates


def assign_lsoa_to_msoa(msoa_list, centroids):
    """Use STRtree spatial index to assign each LSOA centroid to its containing MSOA.
    Returns {msoa_code: [list of lsoa_codes]}.
    """
    print("\nBuilding spatial index...")
    geoms = [item[2] for item in msoa_list]
    tree = STRtree(geoms)

    assignments = {}

    print("Assigning LSOAs to MSOAs (point-in-polygon)...")
    total = len(centroids)
    milestone = total // 10

    for i, (lsoa_code, (lat, lon)) in enumerate(centroids.items()):
        if milestone > 0 and i > 0 and i % milestone == 0:
            pct = i * 100 // total
            print(f"  {pct}% ({i}/{total})...")

        point = Point(lon, lat)  # Shapely uses (x=lon, y=lat)
        idx = tree.nearest(point)
        msoa_code = msoa_list[idx][0]

        # Verify containment; if nearest doesn't contain, check all candidates
        if not geoms[idx].contains(point):
            candidates = tree.query(point)
            if hasattr(candidates, '__iter__'):
                for candidate_idx in candidates:
                    if geoms[candidate_idx].contains(point):
                        msoa_code = msoa_list[candidate_idx][0]
                        break

        assignments.setdefault(msoa_code, []).append(lsoa_code)

    matched_lsoas = sum(len(v) for v in assignments.values())
    print(f"  Assigned {matched_lsoas} LSOAs to {len(assignments)} MSOAs")
    return assignments


def main():
    print("=== MSOA Income Deprivation Choropleth Generator ===\n")

    # 1. Load MSOA boundaries
    msoa_list = load_msoa_boundaries()

    # 2. Load LSOA centroids
    print("\nLoading LSOA centroids...")
    centroids = load_lsoa_centroids()

    # 3. Load income deprivation rates
    print("\nLoading income deprivation rates...")
    england_rates = load_england_income_rates()
    wales_rates = load_wales_income_rates()
    all_rates = {**england_rates, **wales_rates}
    print(f"  Total rates: {len(all_rates)}")

    # 4. Assign LSOAs to MSOAs
    assignments = assign_lsoa_to_msoa(msoa_list, centroids)

    # 5. Compute mean income rate per MSOA
    print("\nAggregating income rates per MSOA...")
    msoa_rates = {}
    no_rate_count = 0
    for msoa_code, lsoa_codes in assignments.items():
        rates = [all_rates[c] for c in lsoa_codes if c in all_rates]
        if rates:
            msoa_rates[msoa_code] = sum(rates) / len(rates)
        else:
            no_rate_count += 1

    print(f"  MSOAs with income data: {len(msoa_rates)}")
    if no_rate_count:
        print(f"  MSOAs without income data: {no_rate_count}")

    rate_vals = list(msoa_rates.values())
    print(f"  Income rate range: {min(rate_vals):.3f} - {max(rate_vals):.3f}")

    # 6. Compute UK-wide normalized scores and deciles
    print("\nComputing deciles...")
    sorted_codes = sorted(msoa_rates.keys(), key=lambda c: msoa_rates[c])
    n = len(sorted_codes)
    msoa_deciles = {}
    msoa_normalized = {}
    for i, code in enumerate(sorted_codes):
        normalized = round(i / max(n - 1, 1) * 100, 1)
        decile = min(10, int(normalized / 10) + 1)
        msoa_deciles[code] = decile
        msoa_normalized[code] = normalized

    # 7. Build output GeoJSON with scores embedded
    print("\nBuilding output GeoJSON...")
    features = []
    for code, name, geom, geojson_geom in msoa_list:
        if code not in msoa_rates:
            continue

        nation = "England" if code.startswith("E") else "Wales"
        source = "IMD 2025" if nation == "England" else "WIMD 2025"

        feature = {
            "type": "Feature",
            "properties": {
                "c": code,
                "n": name,
                "s": round(msoa_normalized[code], 1),
                "d": msoa_deciles[code],
                "r": round(msoa_rates[code], 3),
                "src": source,
            },
            "geometry": geojson_geom,
        }
        features.append(feature)

    geojson = {"type": "FeatureCollection", "features": features}
    print(f"  Features: {len(features)}")

    # 8. Write tmp GeoJSON
    print(f"\nWriting temporary GeoJSON ({TMP_GEOJSON})...")
    with open(TMP_GEOJSON, "w") as f:
        json.dump(geojson, f)
    tmp_size = os.path.getsize(TMP_GEOJSON) / (1024 * 1024)
    print(f"  GeoJSON size: {tmp_size:.1f} MB")

    # 9. Convert to TopoJSON via geo2topo
    print(f"\nConverting to TopoJSON ({OUT_TOPO})...")
    try:
        npx = os.path.join(ROOT_DIR, "node_modules", ".bin", "geo2topo")
        if not os.path.exists(npx):
            npx = "npx geo2topo"
        else:
            npx = f'"{npx}"'

        cmd = f'{npx} msoa="{TMP_GEOJSON}" -q 1e5 -o "{OUT_TOPO}"'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=ROOT_DIR)
        if result.returncode != 0:
            print(f"  geo2topo error: {result.stderr}")
            print("  Falling back to GeoJSON output...")
            os.rename(TMP_GEOJSON, OUT_TOPO)
        else:
            topo_size = os.path.getsize(OUT_TOPO) / (1024 * 1024)
            print(f"  TopoJSON size: {topo_size:.1f} MB (compression: {(1 - topo_size / tmp_size) * 100:.0f}%)")
            os.remove(TMP_GEOJSON)
    except Exception as e:
        print(f"  Error during TopoJSON conversion: {e}")
        print("  Falling back to GeoJSON output...")
        os.rename(TMP_GEOJSON, OUT_TOPO)

    final_size = os.path.getsize(OUT_TOPO) / (1024 * 1024)
    print(f"\n=== Done! Output: {OUT_TOPO} ({final_size:.1f} MB) ===")


if __name__ == "__main__":
    main()
