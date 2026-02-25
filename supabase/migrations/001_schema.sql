-- Country Explorer schema
-- Public read-only tables for QSR location data

-- Countries
CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  map_center_lat DOUBLE PRECISION NOT NULL,
  map_center_lng DOUBLE PRECISION NOT NULL,
  map_zoom INTEGER NOT NULL DEFAULT 6
);

-- Regions within a country
CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL REFERENCES countries(code),
  name TEXT NOT NULL,
  population INTEGER NOT NULL,
  centroid_lat DOUBLE PRECISION NOT NULL,
  centroid_lng DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_regions_country ON regions(country_code);

-- Brands
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL REFERENCES countries(code),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  emoji TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_brands_country ON brands(country_code);

-- Individual restaurant locations
CREATE TABLE IF NOT EXISTS locations (
  id BIGSERIAL PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  region_id TEXT NOT NULL REFERENCES regions(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT,
  city TEXT,
  postcode TEXT,
  opened_date DATE
);

CREATE INDEX IF NOT EXISTS idx_locations_brand ON locations(brand_id);
CREATE INDEX IF NOT EXISTS idx_locations_region ON locations(region_id);

-- Pre-aggregated region-brand counts (denormalized for fast reads)
CREATE TABLE IF NOT EXISTS region_brand_stats (
  region_id TEXT NOT NULL REFERENCES regions(id),
  brand_id TEXT NOT NULL REFERENCES brands(id),
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (region_id, brand_id)
);

-- Enable Row Level Security (public read-only)
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE region_brand_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read countries" ON countries FOR SELECT USING (true);
CREATE POLICY "Public read regions" ON regions FOR SELECT USING (true);
CREATE POLICY "Public read brands" ON brands FOR SELECT USING (true);
CREATE POLICY "Public read locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Public read region_brand_stats" ON region_brand_stats FOR SELECT USING (true);
