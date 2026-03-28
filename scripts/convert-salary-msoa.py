#!/usr/bin/env python3
"""
Create MSOA-level salary choropleth from BRES employment × ASHE median pay.

Pipeline:
  1. Load BRES employment counts by LA × SIC section
  2. Load ASHE median annual pay by SIC section (UK-wide)
  3. Compute weighted average salary per LA
  4. Map each MSOA to its parent LA (msoa-names-lad.csv)
  5. Assign LA salary to all MSOAs in that LA
  6. Embed salary into MSOA boundary GeoJSON
  7. Convert to TopoJSON

Sources:
  - BRES employment (NOMIS NM_141_1): LA × SIC section
  - ASHE 2023 Table 16.5a: UK median annual pay by SIC
  - msoa-names-lad.csv: MSOA → LA mapping
  - msoa-boundaries-bgc.geojson: MSOA polygon boundaries

Output: public/msoa-salary-topo.json
"""

import csv
import json
import os
import subprocess
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
EXT_DIR = os.path.join(ROOT_DIR, "src", "data", "Data for assignment", "external")
MSOA_GEOJSON = os.path.join(EXT_DIR, "msoa-boundaries-bgc.geojson")
TMP_GEOJSON = os.path.join(ROOT_DIR, "public", "_msoa-salary-tmp.geojson")
OUT_TOPO = os.path.join(ROOT_DIR, "public", "msoa-salary-topo.json")


def load_employment_by_sic():
    """Load BRES employment counts by LA × SIC section."""
    bres_path = os.path.join(EXT_DIR, "bres-employment-la-sic.csv")
    fallback_path = os.path.join(EXT_DIR, "business-counts-la-sic.csv")
    path = bres_path if os.path.exists(bres_path) else fallback_path

    la_sic = defaultdict(dict)
    with open(path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            la_name = row["GEOGRAPHY_NAME"].strip()
            industry = row["INDUSTRY_NAME"].strip()
            value = row["OBS_VALUE"].strip()
            if not value:
                continue
            sic_letter = industry.split(":")[0].strip()
            la_sic[la_name][sic_letter] = int(float(value))
    print(f"  BRES data for {len(la_sic)} Local Authorities")
    return la_sic


def load_ashe_pay():
    """Load ASHE median annual pay by SIC section."""
    path = os.path.join(EXT_DIR, "ashe-median-pay-by-sic.csv")
    pay = {}
    with open(path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            pay[row["sic_section"].strip()] = int(row["median_annual_pay"].strip())
    print(f"  ASHE pay for {len(pay)} SIC sections")
    return pay


def load_msoa_to_la():
    """Load MSOA → LA name mapping."""
    path = os.path.join(EXT_DIR, "msoa-names-lad.csv")
    mapping = {}
    with open(path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            mapping[row["msoa21cd"].strip()] = row["localauthorityname"].strip()
    print(f"  MSOA → LA mappings: {len(mapping)}")
    return mapping


def compute_weighted_salary(sic_profile, ashe_pay):
    """Compute weighted average salary for an LA."""
    total = 0
    weighted = 0
    for sic, count in sic_profile.items():
        pay = ashe_pay.get(sic, 0)
        if pay > 0 and count > 0:
            weighted += count * pay
            total += count
    return round(weighted / total) if total > 0 else 0


def match_la_names(biz_names, msoa_la_names):
    """Fuzzy-match LA names between BRES and msoa-names-lad datasets."""
    def normalize(name):
        return name.lower().replace(",", "").replace("'", "").replace("-", " ").strip()

    mapping = {}
    norm_biz = {normalize(n): n for n in biz_names}

    for la_name in msoa_la_names:
        if la_name in biz_names:
            mapping[la_name] = la_name
        else:
            norm = normalize(la_name)
            if norm in norm_biz:
                mapping[la_name] = norm_biz[norm]
    return mapping


def main():
    print("=== MSOA Salary Choropleth Generator ===\n")

    # 1. Load data sources
    print("Loading data sources...")
    la_sic = load_employment_by_sic()
    ashe_pay = load_ashe_pay()
    msoa_to_la = load_msoa_to_la()

    # 2. Compute salary per LA
    print("\nComputing weighted salaries per LA...")
    la_salary = {}
    for la_name, sic_profile in la_sic.items():
        la_salary[la_name] = compute_weighted_salary(sic_profile, ashe_pay)

    salaries = [s for s in la_salary.values() if s > 0]
    print(f"  Range: £{min(salaries):,} – £{max(salaries):,}")
    print(f"  Median: £{sorted(salaries)[len(salaries)//2]:,}")

    # 3. Match LA names
    unique_msoa_las = set(msoa_to_la.values())
    la_name_map = match_la_names(set(la_sic.keys()), unique_msoa_las)
    print(f"  Matched {len(la_name_map)} of {len(unique_msoa_las)} LA names")

    # Build MSOA → salary lookup
    msoa_salary = {}
    no_salary = 0
    for msoa_code, la_name in msoa_to_la.items():
        biz_name = la_name_map.get(la_name)
        if biz_name and biz_name in la_salary:
            msoa_salary[msoa_code] = la_salary[biz_name]
        else:
            no_salary += 1

    print(f"  MSOAs with salary: {len(msoa_salary)}, without: {no_salary}")

    # 4. Compute salary deciles
    print("\nComputing salary deciles...")
    sorted_codes = sorted(msoa_salary.keys(), key=lambda c: msoa_salary[c])
    n = len(sorted_codes)
    msoa_decile = {}
    for i, code in enumerate(sorted_codes):
        normalized = i / max(n - 1, 1)
        msoa_decile[code] = min(10, int(normalized * 10) + 1)

    # 5. Load MSOA boundaries and embed salary
    print("\nLoading MSOA boundaries...")
    with open(MSOA_GEOJSON, "r", encoding="utf-8") as f:
        geojson = json.load(f)

    features = []
    for feat in geojson["features"]:
        code = feat["properties"].get("MSOA21CD", "")
        if code not in msoa_salary:
            continue
        salary = msoa_salary[code]
        decile = msoa_decile[code]
        la_name = msoa_to_la.get(code, "")
        name = feat["properties"].get("MSOA21NM", "")

        features.append({
            "type": "Feature",
            "properties": {
                "c": code,
                "n": name,
                "sal": salary,
                "d": decile,
                "la": la_name,
            },
            "geometry": feat["geometry"],
        })

    print(f"  Features with salary: {len(features)}")

    # 6. Write tmp GeoJSON
    output_geojson = {"type": "FeatureCollection", "features": features}
    with open(TMP_GEOJSON, "w") as f:
        json.dump(output_geojson, f)
    tmp_size = os.path.getsize(TMP_GEOJSON) / (1024 * 1024)
    print(f"  Tmp GeoJSON: {tmp_size:.1f} MB")

    # 7. Convert to TopoJSON with quantization
    print(f"\nConverting to TopoJSON...")
    npx = os.path.join(ROOT_DIR, "node_modules", ".bin", "geo2topo")
    if not os.path.exists(npx):
        npx = "npx geo2topo"
    else:
        npx = f'"{npx}"'

    cmd = f'{npx} msoa="{TMP_GEOJSON}" -q 1e5 -o "{OUT_TOPO}"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=ROOT_DIR)
    if result.returncode != 0:
        print(f"  geo2topo error: {result.stderr}")
        os.rename(TMP_GEOJSON, OUT_TOPO)
    else:
        topo_size = os.path.getsize(OUT_TOPO) / (1024 * 1024)
        print(f"  TopoJSON: {topo_size:.1f} MB (was {tmp_size:.1f} MB)")
        os.remove(TMP_GEOJSON)

    print(f"\n=== Done! {OUT_TOPO} ===")


if __name__ == "__main__":
    main()
