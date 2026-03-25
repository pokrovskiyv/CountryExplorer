#!/usr/bin/env bash
# Download external UK open data for Location Intelligence agents
# All data is free under Open Government Licence v3.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
EXT_DIR="$ROOT_DIR/src/data/Data for assignment/external"

mkdir -p "$EXT_DIR"
cd "$EXT_DIR"

echo "=== Downloading external data to $EXT_DIR ==="

# 1. ORR Station Usage (Table 1410: entries/exits by station)
echo ""
echo "[1/8] ORR Station Usage..."
if [ ! -f "orr-station-usage.csv" ]; then
  curl -L -o "orr-station-usage.csv" \
    "https://dataportal.orr.gov.uk/media/1909/table-1410-passenger-entries-and-exits-and-interchanges-by-station.csv"
  echo "  Downloaded orr-station-usage.csv"
else
  echo "  Already exists, skipping"
fi

# 2. NaPTAN (National Public Transport Access Nodes — station coordinates)
echo ""
echo "[2/8] NaPTAN station coordinates..."
if [ ! -f "naptan-stops.csv" ]; then
  curl -L -o "naptan-stops.csv" \
    "https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv"
  echo "  Downloaded naptan-stops.csv"
else
  echo "  Already exists, skipping"
fi

# 3. DfT Traffic Counts (AADF + count points)
echo ""
echo "[3/8] DfT Traffic Counts..."
if [ ! -f "dft_traffic_counts_aadf.csv" ]; then
  curl -L -o "dft_aadf.zip" \
    "https://storage.googleapis.com/dft-statistics/road-traffic/downloads/data-gov-uk/dft_traffic_counts_aadf.zip"
  unzip -o "dft_aadf.zip" -d "."
  rm -f "dft_aadf.zip"
  echo "  Downloaded and extracted AADF data"
else
  echo "  Already exists, skipping"
fi

if [ ! -f "count_points.csv" ]; then
  curl -L -o "count_points.zip" \
    "https://storage.googleapis.com/dft-statistics/road-traffic/downloads/data-gov-uk/count_points.zip"
  unzip -o "count_points.zip" -d "."
  rm -f "count_points.zip"
  echo "  Downloaded and extracted count points"
else
  echo "  Already exists, skipping"
fi

# 4. IMD 2025 File 7 (all ranks, scores, deciles)
echo ""
echo "[4/8] IMD 2025..."
if [ ! -f "imd-2025-file7.csv" ]; then
  curl -L -o "imd-2025-file7.csv" \
    "https://assets.publishing.service.gov.uk/media/691ded56d140bbbaa59a2a7d/File_7_IoD2025_All_Ranks_Scores_Deciles_Population_Denominators.csv"
  echo "  Downloaded imd-2025-file7.csv"
else
  echo "  Already exists, skipping"
fi

# 5. WIMD 2025 (Welsh Index of Multiple Deprivation)
echo ""
echo "[5/8] WIMD 2025..."
if [ ! -f "wimd-2025-scores.ods" ]; then
  curl -L -o "wimd-2025-scores.ods" \
    "https://www.gov.wales/sites/default/files/statistics-and-research/2025-11/wimd-2025-index-and-domain-scores-by-small-area.ods"
  echo "  Downloaded wimd-2025-scores.ods"
else
  echo "  Already exists, skipping"
fi

# 6. SIMD 2020v2 (Scottish Index of Multiple Deprivation)
echo ""
echo "[6/8] SIMD 2020v2..."
if [ ! -f "simd-2020v2-indicators.xlsx" ]; then
  curl -L -o "simd-2020v2-indicators.xlsx" \
    "https://www.gov.scot/binaries/content/documents/govscot/publications/statistics/2020/01/scottish-index-of-multiple-deprivation-2020-indicator-data/documents/simd_2020_indicators/simd_2020_indicators/govscot%3Adocument/SIMD%2B2020v2%2B-%2Bindicators.xlsx"
  echo "  Downloaded simd-2020v2-indicators.xlsx"
else
  echo "  Already exists, skipping"
fi

if [ ! -f "simd-2020v2-ranks.xlsx" ]; then
  curl -L -o "simd-2020v2-ranks.xlsx" \
    "https://www.gov.scot/binaries/content/documents/govscot/publications/statistics/2020/01/scottish-index-of-multiple-deprivation-2020-ranks-and-domain-ranks/documents/scottish-index-of-multiple-deprivation-2020-ranks-and-domain-ranks/scottish-index-of-multiple-deprivation-2020-ranks-and-domain-ranks/govscot%3Adocument/SIMD%2B2020v2%2B-%2Branks.xlsx"
  echo "  Downloaded simd-2020v2-ranks.xlsx"
else
  echo "  Already exists, skipping"
fi

# 7. NIMDM 2017 (Northern Ireland Multiple Deprivation Measure)
echo ""
echo "[7/8] NIMDM 2017..."
if [ ! -f "nimdm17-soa-results.xls" ]; then
  curl -L -o "nimdm17-soa-results.xls" \
    "https://www.nisra.gov.uk/files/nisra/publications/NIMDM17_SOAresults.xls"
  echo "  Downloaded nimdm17-soa-results.xls"
else
  echo "  Already exists, skipping"
fi

# 8. Census 2021 Workday Population (WD001 at MSOA level)
# This needs to be downloaded from Nomis bulk data
echo ""
echo "[8/8] Census 2021 Workday Population..."
if [ ! -f "census-wd001-msoa.csv" ]; then
  # Nomis bulk API for WD001 at MSOA level (England & Wales)
  curl -L -o "census-wd001-msoa.csv" \
    "https://www.nomisweb.co.uk/api/v01/dataset/NM_2090_1.data.csv?date=latest&geography=TYPE297&measures=20100" 2>/dev/null || {
    echo "  WARNING: Nomis API download failed. Will try alternative approach."
    echo "  You may need to download WD001 manually from https://www.nomisweb.co.uk/sources/census_2021_wd"
  }
  if [ -f "census-wd001-msoa.csv" ]; then
    echo "  Downloaded census-wd001-msoa.csv"
  fi
else
  echo "  Already exists, skipping"
fi

echo ""
echo "=== Download complete ==="
echo "Files in $EXT_DIR:"
ls -lh "$EXT_DIR"
