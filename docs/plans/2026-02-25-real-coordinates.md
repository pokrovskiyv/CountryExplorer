# Real Coordinates Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace synthetic restaurant coordinates with real data from GeoJSON assignment files.

**Architecture:** Python script reads 6 brand GeoJSON files, normalizes to `[lat, lng, address, city, postcode]` tuples, uses point-in-polygon with UK regions GeoJSON for region assignment, generates `brand-points.ts`, `city-region-mapping.ts`, and updates `REGION_COUNTS`.

**Tech Stack:** Python 3 + shapely (point-in-polygon), JSON, TypeScript code generation

---

### Task 1: Write Python conversion script

**Files:**
- Create: `scripts/convert-geojson.py`

**Step 1: Write script**

Script reads 6 GeoJSON files, normalizes per-brand field differences:
- KFC: `name`, `street`, `city`, `postalcode`
- McDonald's: `name`, `address`, `city`, `postcode`
- Nando's: `name`, `address.streetAddress`, `address.addressLocality`, `address.postalCode`
- Domino's: `name`, `location.address.line1`, `location.address.town`, `location.address.postcode`
- Papa John's: `name`, `street`, `town`, `postcode`
- Subway: `name`, `address1`, `city`, `postcode`

Filters out KFC test entries (LAB_*). Uses shapely for point-in-polygon with UK regions GeoJSON.

Generates:
- `src/data/brand-points.ts`
- `src/data/city-region-mapping.ts`
- Updates REGION_COUNTS in `src/data/uk-data.ts`

**Step 2: Run script**

Run: `python3 scripts/convert-geojson.py`

### Task 2: Verify build

Run: `npm run build` (or equivalent)
Expected: No TypeScript errors

### Task 3: Visual verification

Run dev server, check map renders real coordinates correctly.

### Task 4: Commit

```bash
git add scripts/convert-geojson.py src/data/brand-points.ts src/data/city-region-mapping.ts src/data/uk-data.ts
git commit -m "feat: replace synthetic coordinates with real restaurant data from GeoJSON"
```
