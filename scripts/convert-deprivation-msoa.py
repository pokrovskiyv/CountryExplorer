#!/usr/bin/env python3
"""
Aggregate LSOA-level deprivation scores to MSOA polygons and output TopoJSON.

Pipeline:
  1. Load MSOA boundary polygons (7,264 MSOAs, England & Wales)
  2. Load LSOA centroids + IMD/WIMD deprivation scores
  3. Assign each LSOA to its containing MSOA via spatial index (STRtree)
  4. Compute mean deprivation score per MSOA
  5. Assign UK-wide deciles (1-10)
  6. Output GeoJSON with scores, then convert to TopoJSON via geo2topo

Sources:
  - MSOA boundaries: ONS Open Geography Portal (BGC Dec 2021 V3)
  - IMD 2025 File 7: England (33,756 LSOAs)
  - WIMD 2025: Wales (1,917 LSOAs)

Output: public/msoa-deprivation-topo.json
"""

import csv
import json
import math
import os
import subprocess
import sys

from shapely.geometry import Point, shape
from shapely import STRtree

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
EXT_DIR = os.path.join(ROOT_DIR, "src", "data", "Data for assignment", "external")
MSOA_GEOJSON = os.path.join(EXT_DIR, "msoa-boundaries-bgc.geojson")
TMP_GEOJSON = os.path.join(ROOT_DIR, "public", "_msoa-deprivation-tmp.geojson")
OUT_TOPO = os.path.join(ROOT_DIR, "public", "msoa-deprivation-topo.json")


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


def load_england_scores():
    """Load IMD 2025 composite scores. Returns {lsoa_code: score}."""
    import pandas as pd

    path = os.path.join(EXT_DIR, "imd-2025-file7.csv")
    df = pd.read_csv(path, encoding="utf-8-sig")
    scores = {}
    for _, row in df.iterrows():
        code = str(row["LSOA code (2021)"]).strip()
        score = float(row["Index of Multiple Deprivation (IMD) Score"])
        scores[code] = score
    print(f"  England IMD scores: {len(scores)}")
    return scores


def load_wales_scores():
    """Load WIMD 2025 composite scores. Returns {lsoa_code: score}."""
    import pandas as pd

    path = os.path.join(EXT_DIR, "wimd-2025-scores.ods")
    if not os.path.exists(path):
        print("  WARNING: WIMD file not found, skipping Wales")
        return {}

    df = pd.read_excel(path, engine="odf", sheet_name="Data", skiprows=3)
    df.columns = [str(c).strip() for c in df.columns]

    overall_col = None
    for c in df.columns:
        if "wimd" in c.lower() and "2025" in c.lower():
            overall_col = c
            break
    if not overall_col:
        for c in df.columns:
            if "wimd" in c.lower():
                overall_col = c
                break
    if not overall_col:
        print("  WARNING: Cannot find WIMD column, skipping Wales")
        return {}

    code_col = None
    for c in df.columns:
        if "lsoa" in c.lower() and "code" in c.lower():
            code_col = c
            break
    if not code_col:
        code_col = df.columns[0]

    scores = {}
    for _, row in df.iterrows():
        code_val = row[code_col]
        score_val = row[overall_col]
        if pd.isna(code_val) or pd.isna(score_val):
            continue
        scores[str(code_val).strip()] = float(score_val)

    print(f"  Wales WIMD scores: {len(scores)}")
    return scores


def assign_lsoa_to_msoa(msoa_list, centroids):
    """Use STRtree spatial index to assign each LSOA centroid to its containing MSOA.
    Returns {msoa_code: [list of lsoa_codes]}.
    """
    print("\nBuilding spatial index...")
    geoms = [item[2] for item in msoa_list]
    tree = STRtree(geoms)

    assignments = {}
    unmatched = 0

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
            # Try query to find all candidates within bounding box
            found = False
            candidates = tree.query(point)
            if hasattr(candidates, '__iter__'):
                for candidate_idx in candidates:
                    if geoms[candidate_idx].contains(point):
                        msoa_code = msoa_list[candidate_idx][0]
                        found = True
                        break
            if not found:
                # Use nearest as fallback (centroid might be slightly outside due to generalized boundaries)
                pass

        assignments.setdefault(msoa_code, []).append(lsoa_code)

    matched_lsoas = sum(len(v) for v in assignments.values())
    print(f"  Assigned {matched_lsoas} LSOAs to {len(assignments)} MSOAs")
    if unmatched > 0:
        print(f"  Unmatched LSOAs: {unmatched}")
    return assignments


def main():
    print("=== MSOA Deprivation Choropleth Generator ===\n")

    # 1. Load MSOA boundaries
    msoa_list = load_msoa_boundaries()

    # 2. Load LSOA centroids
    print("\nLoading LSOA centroids...")
    centroids = load_lsoa_centroids()

    # 3. Load deprivation scores
    print("\nLoading deprivation scores...")
    england_scores = load_england_scores()
    wales_scores = load_wales_scores()
    all_scores = {**england_scores, **wales_scores}
    print(f"  Total scores: {len(all_scores)}")

    # 4. Assign LSOAs to MSOAs
    assignments = assign_lsoa_to_msoa(msoa_list, centroids)

    # 5. Compute mean score per MSOA
    print("\nAggregating scores per MSOA...")
    msoa_scores = {}
    no_score_count = 0
    for msoa_code, lsoa_codes in assignments.items():
        scores = [all_scores[c] for c in lsoa_codes if c in all_scores]
        if scores:
            msoa_scores[msoa_code] = sum(scores) / len(scores)
        else:
            no_score_count += 1

    print(f"  MSOAs with scores: {len(msoa_scores)}")
    if no_score_count:
        print(f"  MSOAs without scores: {no_score_count}")

    score_vals = list(msoa_scores.values())
    print(f"  Score range: {min(score_vals):.1f} - {max(score_vals):.1f}")

    # 6. Compute UK-wide deciles
    print("\nComputing deciles...")
    sorted_codes = sorted(msoa_scores.keys(), key=lambda c: msoa_scores[c])
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
        if code not in msoa_scores:
            continue

        # Determine nation from code prefix
        nation = "England" if code.startswith("E") else "Wales"
        source = "IMD 2025" if nation == "England" else "WIMD 2025"

        feature = {
            "type": "Feature",
            "properties": {
                "c": code,
                "n": name,
                "s": round(msoa_normalized[code], 1),
                "d": msoa_deciles[code],
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

    # 9. Convert to TopoJSON via geo2topo + toposimplify
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
            # Fallback: just copy GeoJSON as-is
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
