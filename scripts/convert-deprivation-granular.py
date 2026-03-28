#!/usr/bin/env python3
"""
Generate LSOA/DataZone-level deprivation data for the granular map layer.

Reads deprivation indices from 3 nations + centroids, outputs a compact TypeScript
file with ~42K [lat, lon, normalizedScore, decile, nation] tuples.

Nations:
  - England: IMD 2025 File 7 (33,756 LSOAs)
  - Wales: WIMD 2025 (1,917 LSOAs)
  - Scotland: SIMD 2020v2 (6,976 DataZones)
  - N. Ireland: skipped (no centroid file available)

Output: src/data/deprivation-granular.ts
"""

import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
EXT_DIR = os.path.join(ROOT_DIR, "src", "data", "Data for assignment", "external")
OUT_FILE = os.path.join(ROOT_DIR, "src", "data", "deprivation-granular.ts")

SIMD_TOTAL_DZ = 6976


def load_centroids():
    """Load LSOA (England/Wales) and DataZone (Scotland) centroids.
    Returns dict: {code: (lat, lon)}.
    """
    import csv

    centroids = {}

    # England & Wales LSOAs
    lsoa_path = os.path.join(EXT_DIR, "lsoa-centroids-2021.csv")
    with open(lsoa_path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            code = row["LSOA21CD"].strip()
            centroids[code] = (round(float(row["lat"]), 4), round(float(row["lon"]), 4))
    print(f"  LSOA centroids (England & Wales): {len(centroids)}")

    # Scotland DataZones
    dz_path = os.path.join(EXT_DIR, "dz-centroids-2011.csv")
    before = len(centroids)
    with open(dz_path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            code = row["DataZone"].strip()
            centroids[code] = (round(float(row["lat"]), 4), round(float(row["lon"]), 4))
    print(f"  DataZone centroids (Scotland): {len(centroids) - before}")
    print(f"  Total centroids: {len(centroids)}")
    return centroids


def load_england_scores():
    """Load IMD 2025 File 7 — returns {lsoa_code: composite_score}."""
    import pandas as pd

    path = os.path.join(EXT_DIR, "imd-2025-file7.csv")
    if not os.path.exists(path):
        print(f"  ERROR: {path} not found")
        sys.exit(1)

    df = pd.read_csv(path, encoding="utf-8-sig")
    scores = {}
    for _, row in df.iterrows():
        code = str(row["LSOA code (2021)"]).strip()
        score = float(row["Index of Multiple Deprivation (IMD) Score"])
        scores[code] = score
    print(f"  England LSOAs: {len(scores)} (score range: {min(scores.values()):.1f}-{max(scores.values()):.1f})")
    return scores


def load_wales_scores():
    """Load WIMD 2025 — returns {lsoa_code: composite_score}.
    WIMD composite score: higher = more deprived (matches England convention).
    """
    import pandas as pd

    path = os.path.join(EXT_DIR, "wimd-2025-scores.ods")
    if not os.path.exists(path):
        print(f"  WARNING: {path} not found, skipping Wales")
        return {}

    df = pd.read_excel(path, engine="odf", sheet_name="Data", skiprows=3)
    df.columns = [str(c).strip() for c in df.columns]

    # Find the WIMD overall column
    overall_col = None
    for c in df.columns:
        cl = c.lower()
        if "wimd" in cl and "2025" in cl:
            overall_col = c
            break
    if not overall_col:
        for c in df.columns:
            if "wimd" in c.lower():
                overall_col = c
                break
    if not overall_col:
        print(f"  WARNING: Cannot find WIMD overall column, skipping Wales")
        return {}

    print(f"  Using WIMD column: '{overall_col}'")

    # Find LSOA code column
    code_col = None
    for c in df.columns:
        cl = c.lower()
        if "lsoa" in cl and "code" in cl:
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
        code = str(code_val).strip()
        scores[code] = float(score_val)

    if scores:
        print(f"  Wales LSOAs: {len(scores)} (score range: {min(scores.values()):.1f}-{max(scores.values()):.1f})")
    return scores


def load_scotland_scores():
    """Load SIMD 2020v2 ranks → convert to 0-100 score.
    Returns {datazone_code: composite_score} where higher = more deprived.
    """
    import pandas as pd

    ranks_path = os.path.join(EXT_DIR, "simd-2020v2-ranks.xlsx")
    if not os.path.exists(ranks_path):
        print(f"  WARNING: {ranks_path} not found, skipping Scotland")
        return {}

    df = pd.read_excel(ranks_path, sheet_name="SIMD 2020v2 ranks")
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]

    dz_col = next((c for c in df.columns if "data_zone" in c or "datazone" in c), df.columns[0])
    rank_col = next((c for c in df.columns if "simd2020" in c and "rank" in c), None)
    if not rank_col:
        rank_col = next((c for c in df.columns if "rank" in c), None)

    if not rank_col:
        print(f"  WARNING: Cannot find SIMD rank column, skipping Scotland")
        return {}

    scores = {}
    for _, row in df.iterrows():
        code_val = row[dz_col]
        rank_val = row[rank_col]
        if pd.isna(code_val) or pd.isna(rank_val):
            continue
        code = str(code_val).strip()
        try:
            rank = int(rank_val)
        except (ValueError, TypeError):
            continue
        # Convert rank to 0-100 score: rank 1 (most deprived) → ~100, rank 6976 → ~0
        score = (SIMD_TOTAL_DZ - rank) / SIMD_TOTAL_DZ * 100
        scores[code] = score

    if scores:
        print(f"  Scotland DataZones: {len(scores)} (score range: {min(scores.values()):.1f}-{max(scores.values()):.1f})")
    return scores


def main():
    print("=== Generating granular deprivation data ===\n")

    # 1. Load centroids
    print("Loading centroids...")
    centroids = load_centroids()

    # 2. Load scores from each nation
    print("\nLoading deprivation scores...")
    print("[England] IMD 2025...")
    england = load_england_scores()

    print("[Wales] WIMD 2025...")
    wales = load_wales_scores()

    print("[Scotland] SIMD 2020v2...")
    scotland = load_scotland_scores()

    # 3. Merge: only keep areas that have both centroid AND score
    # Tag each with nation code: 0=England, 1=Wales, 2=Scotland
    areas = []
    matched = {"england": 0, "wales": 0, "scotland": 0}
    no_centroid = {"england": 0, "wales": 0, "scotland": 0}

    for code, score in england.items():
        if code in centroids:
            lat, lon = centroids[code]
            areas.append((lat, lon, score, 0))
            matched["england"] += 1
        else:
            no_centroid["england"] += 1

    for code, score in wales.items():
        if code in centroids:
            lat, lon = centroids[code]
            areas.append((lat, lon, score, 1))
            matched["wales"] += 1
        else:
            no_centroid["wales"] += 1

    for code, score in scotland.items():
        if code in centroids:
            lat, lon = centroids[code]
            areas.append((lat, lon, score, 2))
            matched["scotland"] += 1
        else:
            no_centroid["scotland"] += 1

    print(f"\nMatched: England={matched['england']}, Wales={matched['wales']}, Scotland={matched['scotland']}")
    print(f"No centroid: England={no_centroid['england']}, Wales={no_centroid['wales']}, Scotland={no_centroid['scotland']}")
    print(f"Total areas with centroid + score: {len(areas)}")

    # 4. Compute UK-wide percentile-based normalized score (0-100) and decile (1-10)
    # Sort by raw score ascending (low deprivation first)
    # Assign normalized score = percentile position * 100
    # Assign decile = ceil(normalizedScore / 10), clamped 1-10
    print("\nComputing UK-wide normalized scores and deciles...")
    areas.sort(key=lambda a: a[2])  # sort by raw score ascending
    n = len(areas)

    output_areas = []
    for i, (lat, lon, raw_score, nation) in enumerate(areas):
        normalized = round(i / max(n - 1, 1) * 100, 1)
        decile = min(10, int(normalized / 10) + 1)
        output_areas.append((lat, lon, normalized, decile, nation))

    # Verify decile distribution
    from collections import Counter
    decile_dist = Counter(a[3] for a in output_areas)
    print(f"  Decile distribution: {dict(sorted(decile_dist.items()))}")

    nation_dist = Counter(a[4] for a in output_areas)
    nation_names = {0: "England", 1: "Wales", 2: "Scotland"}
    print(f"  Nation distribution: {', '.join(f'{nation_names[k]}={v}' for k, v in sorted(nation_dist.items()))}")

    # 5. Generate TypeScript output
    print(f"\nWriting {len(output_areas)} points to {OUT_FILE}...")

    lines = [
        "// LSOA/DataZone-level deprivation data for granular map overlay",
        "// Sources: IMD 2025 (England), WIMD 2025 (Wales), SIMD 2020v2 (Scotland)",
        "// Generated by scripts/convert-deprivation-granular.py",
        "//",
        "// Each tuple: [lat, lon, normalizedScore (0-100), decile (1-10), nation]",
        "// nation: 0=England, 1=Wales, 2=Scotland",
        "// normalizedScore: UK-wide percentile rank (higher = more deprived)",
        "// decile: 1 = least deprived 10%, 10 = most deprived 10%",
        "",
        "export const NATION_LABELS = ['IMD 2025', 'WIMD 2025', 'SIMD 2020v2'] as const",
        "",
        "export type DeprivationTuple = readonly [number, number, number, number, number]",
        "",
        "export const DEPRIVATION_GRANULAR: readonly DeprivationTuple[] = [",
    ]

    for lat, lon, score, decile, nation in output_areas:
        lines.append(f"  [{lat},{lon},{score},{decile},{nation}],")

    lines.append("] as const")
    lines.append("")

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    file_size_kb = os.path.getsize(OUT_FILE) / 1024
    print(f"  File size: {file_size_kb:.0f} KB")
    print("\n=== Done ===")


if __name__ == "__main__":
    main()
