#!/usr/bin/env python3
"""
Convert IMD 2025 data into demographic-data.ts
Aggregates LSOA-level deprivation scores to 12 UK regions.

Input: IMD 2025 File 7 CSV (33,755 LSOA rows)
Output: src/data/demographic-data.ts (12 region records)
"""

import sys
from pathlib import Path
from collections import defaultdict
from dataclasses import dataclass
import pandas as pd


@dataclass
class MicroArea:
    """One LSOA / Data Zone / SOA with fields needed for normalization."""
    region: str
    income_rate: float          # income deprivation rate (nation-specific)
    employment_rate: float      # employment deprivation rate (nation-specific)
    composite_score: float      # nation-normalized 0-100 (higher = more deprived)
    nation: str                 # "england" | "wales" | "scotland" | "ni"
    uk_decile: int = 0          # populated by compute_uk_income_deciles()


ROOT = Path(__file__).resolve().parent.parent
EXT_DIR = ROOT / "src" / "data" / "Data for assignment" / "external"
OUT_DIR = ROOT / "src" / "data"

# Map Local Authority District code prefixes to UK ITL1 regions
# Based on ONS geography lookups
# LA codes starting with E06/E07/E08/E09 = England, W06 = Wales
# We map via the Government Office Region which may be in the IMD data

# For IMD 2025, we'll use the Local Authority District name to map to regions
# since IMD includes the LA code

# ITL1 region mapping based on LA district codes
# Source: ONS Open Geography Portal
LA_TO_REGION = {}  # Will be populated dynamically from the CSV

# England Government Office Regions from IMD
GOR_TO_ITL1 = {
    "North East": "North East (England)",
    "North West": "North West (England)",
    "Yorkshire and The Humber": "Yorkshire and The Humber",
    "East Midlands": "East Midlands (England)",
    "West Midlands": "West Midlands (England)",
    "East of England": "East (England)",
    "East": "East (England)",
    "London": "London",
    "South East": "South East (England)",
    "South West": "South West (England)",
}


def load_wimd() -> list[MicroArea]:
    """Load WIMD 2025 scores ODS — 1,917 Welsh LSOAs."""
    wimd_file = EXT_DIR / "wimd-2025-scores.ods"
    if not wimd_file.exists():
        print(f"  WARNING: {wimd_file} not found, skipping Wales")
        return []

    df = pd.read_excel(wimd_file, engine="odf", sheet_name=0)
    df.columns = [c.strip().lower() for c in df.columns]
    print(f"  WIMD columns: {list(df.columns[:10])}")

    income_col = next((c for c in df.columns if "income" in c and "score" in c), None)
    employment_col = next((c for c in df.columns if "employment" in c and "score" in c), None)
    overall_col = next((c for c in df.columns if "wimd" in c and "2025" in c and "score" not in c), None)
    if not overall_col:
        overall_col = next((c for c in df.columns if "wimd" in c), None)

    print(f"  Using: income='{income_col}', employment='{employment_col}', overall='{overall_col}'")

    areas = []
    for _, row in df.iterrows():
        try:
            income = float(row[income_col]) if income_col and pd.notna(row.get(income_col)) else 0.0
            employment = float(row[employment_col]) if employment_col and pd.notna(row.get(employment_col)) else 0.0
            composite = float(row[overall_col]) if overall_col and pd.notna(row.get(overall_col)) else 0.0
            income_norm = income / 100 if income > 1 else income
            employment_norm = employment / 100 if employment > 1 else employment
            areas.append(MicroArea(
                region="Wales",
                income_rate=income_norm,
                employment_rate=employment_norm,
                composite_score=composite,
                nation="wales",
            ))
        except (ValueError, TypeError):
            continue

    rates = [a.income_rate for a in areas]
    assert all(0 <= r <= 1 for r in rates), f"WIMD income_rate out of [0,1] range: min={min(rates)}, max={max(rates)}"
    print(f"  Loaded {len(areas)} Welsh LSOAs (income_rate range: {min(rates):.4f}-{max(rates):.4f})")
    return areas


SIMD_TOTAL_DZ = 6976


def load_simd() -> list[MicroArea]:
    """Load SIMD 2020v2 — 6,976 Scottish Data Zones."""
    indicators_file = EXT_DIR / "simd-2020v2-indicators.xlsx"
    ranks_file = EXT_DIR / "simd-2020v2-ranks.xlsx"

    if not indicators_file.exists() or not ranks_file.exists():
        print(f"  WARNING: SIMD files not found, skipping Scotland")
        return []

    df_ind = pd.read_excel(indicators_file, sheet_name=0)
    df_ind.columns = [c.strip().lower().replace(" ", "_") for c in df_ind.columns]

    df_rank = pd.read_excel(ranks_file, sheet_name=0)
    df_rank.columns = [c.strip().lower().replace(" ", "_") for c in df_rank.columns]

    print(f"  SIMD indicator columns: {list(df_ind.columns[:10])}")
    print(f"  SIMD rank columns: {list(df_rank.columns[:10])}")

    dz_col_ind = next((c for c in df_ind.columns if "data_zone" in c or "datazone" in c), df_ind.columns[0])
    dz_col_rank = next((c for c in df_rank.columns if "data_zone" in c or "datazone" in c), df_rank.columns[0])

    income_col = next((c for c in df_ind.columns if "income_rate" in c), None)
    employment_col = next((c for c in df_ind.columns if "employment_rate" in c), None)

    rank_col = next((c for c in df_rank.columns if "simd2020" in c and "rank" in c), None)
    if not rank_col:
        rank_col = next((c for c in df_rank.columns if "rank" in c), None)

    print(f"  Using: income='{income_col}', employment='{employment_col}', rank='{rank_col}'")

    df = df_ind.merge(df_rank[[dz_col_rank, rank_col]], left_on=dz_col_ind, right_on=dz_col_rank, how="left")

    areas = []
    for _, row in df.iterrows():
        try:
            income = float(row[income_col]) if income_col and pd.notna(row.get(income_col)) else 0.0
            employment = float(row[employment_col]) if employment_col and pd.notna(row.get(employment_col)) else 0.0
            rank = int(row[rank_col]) if rank_col and pd.notna(row.get(rank_col)) else SIMD_TOTAL_DZ // 2
            composite = (SIMD_TOTAL_DZ - rank) / SIMD_TOTAL_DZ * 100
            areas.append(MicroArea(
                region="Scotland",
                income_rate=income,
                employment_rate=employment,
                composite_score=composite,
                nation="scotland",
            ))
        except (ValueError, TypeError):
            continue

    print(f"  Loaded {len(areas)} Scottish Data Zones")
    return areas


NIMDM_TOTAL_SOA = 890


def load_nimdm() -> list[MicroArea]:
    """Load NIMDM 2017 — 890 Northern Ireland SOAs."""
    nimdm_file = EXT_DIR / "nimdm17-soa-results.xls"
    if not nimdm_file.exists():
        print(f"  WARNING: {nimdm_file} not found, skipping Northern Ireland")
        return []

    df_mdm = pd.read_excel(nimdm_file, sheet_name="MDM", engine="xlrd")
    df_mdm.columns = [c.strip().lower() for c in df_mdm.columns]
    print(f"  NIMDM MDM columns: {list(df_mdm.columns[:10])}")

    df_income = pd.read_excel(nimdm_file, sheet_name="Income", engine="xlrd")
    df_income.columns = [c.strip().lower() for c in df_income.columns]

    df_employment = pd.read_excel(nimdm_file, sheet_name="Employment", engine="xlrd")
    df_employment.columns = [c.strip().lower() for c in df_employment.columns]

    soa_col_mdm = next((c for c in df_mdm.columns if "soa" in c and "name" not in c), df_mdm.columns[2])
    rank_col = next((c for c in df_mdm.columns if "multiple deprivation" in c and "rank" in c), None)
    if not rank_col:
        rank_col = next((c for c in df_mdm.columns if "rank" in c), None)

    soa_col_inc = next((c for c in df_income.columns if "soa" in c and "name" not in c), df_income.columns[2])
    income_prop_col = next((c for c in df_income.columns if "proportion" in c), None)

    soa_col_emp = next((c for c in df_employment.columns if "soa" in c and "name" not in c), df_employment.columns[2])
    employment_prop_col = next((c for c in df_employment.columns if "proportion" in c), None)

    print(f"  Using: rank='{rank_col}', income='{income_prop_col}', employment='{employment_prop_col}'")

    df = df_mdm.copy()
    if income_prop_col:
        df = df.merge(df_income[[soa_col_inc, income_prop_col]].rename(columns={income_prop_col: "_income_rate"}),
                       left_on=soa_col_mdm, right_on=soa_col_inc, how="left")
    if employment_prop_col:
        df = df.merge(df_employment[[soa_col_emp, employment_prop_col]].rename(columns={employment_prop_col: "_empl_rate"}),
                       left_on=soa_col_mdm, right_on=soa_col_emp, how="left")

    areas = []
    for _, row in df.iterrows():
        try:
            income = float(row.get("_income_rate", 0)) if pd.notna(row.get("_income_rate")) else 0.0
            employment = float(row.get("_empl_rate", 0)) if pd.notna(row.get("_empl_rate")) else 0.0
            rank = int(row[rank_col]) if rank_col and pd.notna(row.get(rank_col)) else NIMDM_TOTAL_SOA // 2
            composite = (NIMDM_TOTAL_SOA - rank) / NIMDM_TOTAL_SOA * 100
            areas.append(MicroArea(
                region="Northern Ireland",
                income_rate=income / 100 if income > 1 else income,
                employment_rate=employment / 100 if employment > 1 else employment,
                composite_score=composite,
                nation="ni",
            ))
        except (ValueError, TypeError):
            continue

    print(f"  Loaded {len(areas)} Northern Ireland SOAs")
    return areas


def load_imd_data() -> list[MicroArea]:
    """Load IMD 2025 File 7 — ~32,844 English LSOAs. Returns list[MicroArea]."""
    imd_file = EXT_DIR / "imd-2025-file7.csv"
    if not imd_file.exists():
        print(f"ERROR: {imd_file} not found. Run download-external-data.sh first.")
        sys.exit(1)

    df = pd.read_csv(imd_file, encoding="utf-8-sig")
    headers = list(df.columns)
    print(f"  IMD columns: {headers[:15]}...")

    la_name_col = find_column(headers, [
        "Local Authority District name",
        "Local Authority District Name",
        "LA District name",
    ])
    income_col = find_column(headers, [
        "Income Score (rate)",
        "Income Score",
        "Income - Score",
    ])
    employment_col = find_column(headers, [
        "Employment Score (rate)",
        "Employment Score",
        "Employment - Score",
    ])
    imd_score_col = find_column(headers, [
        "Index of Multiple Deprivation (IMD) Score",
        "IMD Score",
        "IoD2025 Score",
        "Index of Multiple Deprivation Score",
    ])

    if not income_col:
        print(f"  WARNING: Cannot find income score column. Falling back to IMD score.")
        income_col = imd_score_col

    print(f"  Using columns: income='{income_col}', employment='{employment_col}', "
          f"imd_score='{imd_score_col}', la_name='{la_name_col}'")

    areas = []
    unmapped = set()

    for _, row in df.iterrows():
        la_name = str(row[la_name_col]) if la_name_col and pd.notna(row.get(la_name_col)) else ""
        region = la_to_region(la_name)

        if not region:
            unmapped.add(la_name)
            continue

        try:
            income = float(row[income_col]) if income_col and pd.notna(row.get(income_col)) else 0.0
            employment = float(row[employment_col]) if employment_col and pd.notna(row.get(employment_col)) else 0.0
            composite = float(row[imd_score_col]) if imd_score_col and pd.notna(row.get(imd_score_col)) else 0.0

            areas.append(MicroArea(
                region=region,
                income_rate=income,
                employment_rate=employment,
                composite_score=composite,
                nation="england",
            ))
        except (ValueError, TypeError):
            continue

    if unmapped:
        print(f"  WARNING: {len(unmapped)} LA districts not mapped to regions")
        if len(unmapped) <= 10:
            print(f"  Unmapped: {list(unmapped)[:10]}")

    return areas


def find_column(headers, candidates):
    """Find a column by trying multiple name variants."""
    for candidate in candidates:
        for h in headers:
            if h.strip().lower() == candidate.lower():
                return h
    # Fuzzy: substring match
    for candidate in candidates:
        for h in headers:
            if candidate.lower() in h.strip().lower():
                return h
    return None


# Simple LA district name to region mapping
# This covers the most common LA names in England
# Wales gets its own region
def la_to_region(la_name):
    """Map Local Authority District name to ITL1 region."""
    if not la_name:
        return None

    la_lower = la_name.lower().strip()

    # Wales
    if any(w in la_lower for w in [
        "cardiff", "swansea", "newport", "wrexham", "gwynedd", "anglesey",
        "conwy", "denbigh", "flint", "powys", "ceredigion", "pembroke",
        "carmarthen", "neath", "bridgend", "vale of glamorgan", "rhondda",
        "merthyr", "caerphilly", "blaenau", "torfaen", "monmouth",
    ]):
        return "Wales"

    # London boroughs
    london_boroughs = [
        "barking", "barnet", "bexley", "brent", "bromley", "camden",
        "croydon", "ealing", "enfield", "greenwich", "hackney",
        "hammersmith", "haringey", "harrow", "havering", "hillingdon",
        "hounslow", "islington", "kensington", "kingston", "lambeth",
        "lewisham", "merton", "newham", "redbridge", "richmond",
        "southwark", "sutton", "tower hamlets", "waltham forest",
        "wandsworth", "westminster", "city of london",
    ]
    if any(b in la_lower for b in london_boroughs):
        return "London"

    # North East
    if any(w in la_lower for w in [
        "northumberland", "newcastle", "gateshead", "sunderland",
        "south tyneside", "north tyneside", "county durham", "durham",
        "darlington", "hartlepool", "stockton", "middlesbrough",
        "redcar",
    ]):
        return "North East (England)"

    # North West
    if any(w in la_lower for w in [
        "cumbria", "lancashire", "blackpool", "blackburn", "bolton",
        "bury", "manchester", "oldham", "rochdale", "salford",
        "stockport", "tameside", "trafford", "wigan", "knowsley",
        "liverpool", "sefton", "st helens", "st. helens", "wirral", "halton",
        "warrington", "cheshire", "allerdale", "barrow", "carlisle",
        "copeland", "eden", "south lakeland", "burnley", "chorley",
        "fylde", "hyndburn", "lancaster", "pendle", "preston",
        "ribble valley", "rossendale", "south ribble", "west lancashire",
        "wyre", "chester", "crewe", "congleton", "macclesfield",
        "vale royal", "ellesmere",
        "westmorland", "cumberland",
    ]):
        return "North West (England)"

    # Yorkshire and The Humber
    if any(w in la_lower for w in [
        "barnsley", "doncaster", "rotherham", "sheffield",
        "bradford", "calderdale", "kirklees", "leeds", "wakefield",
        "york", "kingston upon hull", "hull", "east riding",
        "north east lincolnshire", "north lincolnshire",
        "craven", "hambleton", "harrogate", "richmondshire",
        "ryedale", "scarborough", "selby", "north yorkshire",
    ]):
        return "Yorkshire and The Humber"

    # East Midlands
    if any(w in la_lower for w in [
        "derby", "leicester", "rutland", "nottingham",
        "amber valley", "bolsover", "chesterfield", "derbyshire dales",
        "erewash", "high peak", "north east derbyshire", "south derbyshire",
        "blaby", "charnwood", "harborough", "hinckley", "melton",
        "north west leicestershire", "oadby", "ashfield", "bassetlaw",
        "broxtowe", "gedling", "mansfield", "newark", "rushcliffe",
        "boston", "east lindsey", "lincoln", "north kesteven",
        "south holland", "south kesteven", "west lindsey",
        "corby", "daventry", "east northamptonshire", "kettering",
        "northampton", "south northamptonshire", "wellingborough",
        "north northamptonshire", "west northamptonshire",
    ]):
        return "East Midlands (England)"

    # West Midlands
    if any(w in la_lower for w in [
        "birmingham", "coventry", "dudley", "sandwell", "solihull",
        "walsall", "wolverhampton", "bromsgrove", "malvern",
        "redditch", "worcester", "wychavon", "wyre forest",
        "hereford", "shropshire", "telford", "stoke",
        "staffordshire", "cannock", "east staffordshire",
        "lichfield", "newcastle-under-lyme", "south staffordshire",
        "stafford", "tamworth", "north warwickshire",
        "nuneaton", "rugby", "stratford", "warwick",
    ]):
        return "West Midlands (England)"

    # East of England
    if any(w in la_lower for w in [
        "bedford", "central bedfordshire", "luton",
        "peterborough", "cambridge", "east cambridgeshire",
        "fenland", "huntingdonshire", "south cambridgeshire",
        "basildon", "braintree", "brentwood", "castle point",
        "chelmsford", "colchester", "epping", "harlow",
        "maldon", "rochford", "southend", "tendring",
        "thurrock", "uttlesford", "hertford", "hertsmere", "broxbourne",
        "dacorum", "east hertfordshire", "north hertfordshire",
        "st albans", "stevenage", "three rivers", "watford",
        "welwyn", "babergh", "east suffolk", "west suffolk",
        "ipswich", "mid suffolk", "norfolk", "norwich",
        "breckland", "broadland", "great yarmouth",
        "king.*lynn", "north norfolk", "south norfolk",
        "suffolk",
    ]):
        return "East (England)"

    # South East
    if any(w in la_lower for w in [
        "bracknell", "reading", "slough", "windsor", "west berkshire",
        "wokingham", "milton keynes", "buckingham", "aylesbury",
        "chiltern", "south bucks", "wycombe",
        "brighton", "eastbourne", "hastings", "lewes", "rother",
        "wealden", "adur", "arun", "chichester", "crawley",
        "horsham", "mid sussex", "worthing",
        "isle of wight", "portsmouth", "southampton",
        "basingstoke", "east hampshire", "eastleigh", "fareham",
        "gosport", "hart", "havant", "new forest",
        "rushmoor", "test valley", "winchester",
        "ashford", "canterbury", "dartford", "dover",
        "folkestone", "gravesham", "maidstone", "medway",
        "sevenoaks", "swale", "thanet", "tonbridge",
        "tunbridge wells", "elmbridge", "epsom", "guildford",
        "mole valley", "reigate", "runnymede", "spelthorne",
        "surrey heath", "tandridge", "waverley", "woking",
        "cherwell", "oxford", "south oxfordshire",
        "vale of white horse", "west oxfordshire",
        "kent", "surrey", "hampshire", "sussex", "berkshire",
    ]):
        return "South East (England)"

    # South West
    if any(w in la_lower for w in [
        "bath", "bournemouth", "bristol", "cornwall", "devon",
        "dorset", "exeter", "gloucester", "north somerset",
        "plymouth", "poole", "somerset", "south gloucester",
        "swindon", "torbay", "wiltshire", "isles of scilly",
        "cheltenham", "cotswold", "forest of dean", "stroud",
        "tewkesbury", "east devon", "mid devon", "north devon",
        "south hams", "teignbridge", "torridge", "west devon",
        "mendip", "sedgemoor", "south somerset", "taunton",
        "christchurch", "east dorset", "north dorset",
        "purbeck", "west dorset", "weymouth",
        "kennet", "north wiltshire", "salisbury", "west wiltshire",
        "bridgwater",
    ]):
        return "South West (England)"

    return None


def compute_uk_income_deciles(all_areas: list[MicroArea]) -> dict[str, int]:
    """Variant C: normalize income rates across all UK micro-areas into deciles.
    Returns {region: median_uk_decile}."""
    sorted_areas = sorted(all_areas, key=lambda a: a.income_rate)
    n = len(sorted_areas)

    for i, area in enumerate(sorted_areas):
        percentile = i / max(n - 1, 1)
        area.uk_decile = 10 - min(int(percentile * 10), 9)

    region_deciles = defaultdict(list)
    for area in sorted_areas:
        region_deciles[area.region].append(area.uk_decile)

    result = {}
    for region, deciles in region_deciles.items():
        deciles.sort()
        result[region] = deciles[len(deciles) // 2]

    return result


NATION_META = {
    "england": {"source": "IMD 2025", "label": "LSOAs"},
    "wales": {"source": "WIMD 2025", "label": "LSOAs"},
    "scotland": {"source": "SIMD 2020", "label": "Data Zones"},
    "ni": {"source": "NIMDM 2017", "label": "SOAs"},
}


def aggregate_regions(all_areas: list[MicroArea], uk_deciles: dict[str, int]) -> list[dict]:
    """Aggregate micro-areas to region-level records."""
    region_data = defaultdict(lambda: {
        "income_rates": [], "employment_rates": [], "composite_scores": [],
        "count": 0, "nation": None,
    })

    for area in all_areas:
        rd = region_data[area.region]
        rd["income_rates"].append(area.income_rate)
        rd["employment_rates"].append(area.employment_rate)
        rd["composite_scores"].append(area.composite_score)
        rd["count"] += 1
        rd["nation"] = area.nation

    region_order = [
        "North East (England)", "North West (England)", "Yorkshire and The Humber",
        "East Midlands (England)", "West Midlands (England)", "East (England)",
        "London", "South East (England)", "South West (England)",
        "Wales", "Scotland", "Northern Ireland",
    ]

    records = []
    for region in region_order:
        data = region_data.get(region)
        if not data or data["count"] == 0:
            print(f"  WARNING: No data for region '{region}'")
            continue

        meta = NATION_META[data["nation"]]
        avg_income = sum(data["income_rates"]) / len(data["income_rates"])
        avg_employment = sum(data["employment_rates"]) / len(data["employment_rates"])
        avg_composite = sum(data["composite_scores"]) / len(data["composite_scores"])
        median_decile = uk_deciles.get(region, 5)

        records.append({
            "region": region,
            "avgIncomeScore": avg_income,
            "avgEmploymentScore": avg_employment,
            "medianIncomeDecile": median_decile,
            "avgImdScore": avg_composite,
            "lsoaCount": data["count"],
            "deprivationSource": meta["source"],
            "microAreaLabel": meta["label"],
        })

    return records


def generate_demographic_ts(records: list[dict]):
    """Generate demographic-data.ts with expanded interface."""
    lines = [
        "// UK region demographic data from deprivation indices across 4 nations",
        "// Sources: IMD 2025 (England), WIMD 2025 (Wales), SIMD 2020v2 (Scotland), NIMDM 2017 (N. Ireland)",
        "// All data under Open Government Licence v3.0",
        "// Generated by scripts/convert-demographics.py",
        "",
        "export interface RegionDemographics {",
        "  readonly region: string",
        "  readonly avgIncomeScore: number",
        "  readonly avgEmploymentScore: number",
        "  readonly medianIncomeDecile: number",
        "  readonly avgImdScore: number",
        "  readonly lsoaCount: number",
        "  readonly deprivationSource: string",
        "  readonly microAreaLabel: string",
        "}",
        "",
        "export const REGION_DEMOGRAPHICS: readonly RegionDemographics[] = [",
    ]

    for r in records:
        assert 0 <= r["avgImdScore"] <= 100, f"avgImdScore out of range for {r['region']}: {r['avgImdScore']}"
        assert 1 <= r["medianIncomeDecile"] <= 10, f"medianIncomeDecile out of range for {r['region']}: {r['medianIncomeDecile']}"

        lines.append(
            f"  {{ region: '{r['region']}', "
            f"avgIncomeScore: {r['avgIncomeScore']:.4f}, "
            f"avgEmploymentScore: {r['avgEmploymentScore']:.4f}, "
            f"medianIncomeDecile: {r['medianIncomeDecile']}, "
            f"avgImdScore: {r['avgImdScore']:.2f}, "
            f"lsoaCount: {r['lsoaCount']}, "
            f"deprivationSource: '{r['deprivationSource']}', "
            f"microAreaLabel: '{r['microAreaLabel']}' }},"
        )

    lines.append("] as const")
    lines.append("")

    out_path = OUT_DIR / "demographic-data.ts"
    with open(out_path, "w") as f:
        f.write("\n".join(lines))
    print(f"\nWritten {out_path}")


def main():
    print("Loading deprivation data from 4 nations...")

    print("\n[England] IMD 2025...")
    england = load_imd_data()
    print(f"  Total: {len(england)} LSOAs")

    print("\n[Wales] WIMD 2025...")
    wales = load_wimd()

    print("\n[Scotland] SIMD 2020v2...")
    scotland = load_simd()

    print("\n[Northern Ireland] NIMDM 2017...")
    ni = load_nimdm()

    all_areas = england + wales + scotland + ni
    print(f"\nTotal micro-areas: {len(all_areas)}")

    print("\nComputing UK-wide income deciles (Variant C)...")
    uk_deciles = compute_uk_income_deciles(all_areas)
    for region, decile in sorted(uk_deciles.items()):
        print(f"  {region}: decile {decile}")

    print("\nAggregating to 12 regions...")
    records = aggregate_regions(all_areas, uk_deciles)

    generate_demographic_ts(records)
    print("Done!")


if __name__ == "__main__":
    main()
