// Brand definitions
export interface BrandInfo {
  color: string;
  icon: string;
}

export const BRANDS: Record<string, BrandInfo> = {
  Subway: { color: '#22c55e', icon: '🥪' },
  McDonalds: { color: '#facc15', icon: '🍟' },
  Dominos: { color: '#3b82f6', icon: '🍕' },
  KFC: { color: '#ef4444', icon: '🍗' },
  Nandos: { color: '#f97316', icon: '🔥' },
  PapaJohns: { color: '#a855f7', icon: '🍕' },
};

// Population in thousands
export const POPULATION: Record<string, number> = {
  "North East (England)": 2647,
  "North West (England)": 7422,
  "Yorkshire and The Humber": 5541,
  "East Midlands (England)": 4880,
  "West Midlands (England)": 5954,
  "East (England)": 6348,
  "London": 8866,
  "South East (England)": 9294,
  "South West (England)": 5712,
  "Wales": 3131,
  "Scotland": 5447,
  "Northern Ireland": 1903,
};

// Region counts derived from real GeoJSON data via point-in-polygon
export const REGION_COUNTS: Record<string, Record<string, number>> = {
  "North East (England)": { Subway: 92, McDonalds: 63, Dominos: 45, KFC: 36, Nandos: 17, PapaJohns: 7, total: 260 },
  "North West (England)": { Subway: 293, McDonalds: 192, Dominos: 135, KFC: 121, Nandos: 51, PapaJohns: 26, total: 818 },
  "Yorkshire and The Humber": { Subway: 156, McDonalds: 115, Dominos: 86, KFC: 77, Nandos: 31, PapaJohns: 19, total: 484 },
  "East Midlands (England)": { Subway: 154, McDonalds: 123, Dominos: 102, KFC: 64, Nandos: 22, PapaJohns: 39, total: 504 },
  "West Midlands (England)": { Subway: 213, McDonalds: 137, Dominos: 107, KFC: 93, Nandos: 36, PapaJohns: 46, total: 632 },
  "East (England)": { Subway: 190, McDonalds: 150, Dominos: 138, KFC: 88, Nandos: 42, PapaJohns: 52, total: 660 },
  "London": { Subway: 216, McDonalds: 192, Dominos: 151, KFC: 161, Nandos: 127, PapaJohns: 67, total: 914 },
  "South East (England)": { Subway: 236, McDonalds: 197, Dominos: 217, KFC: 142, Nandos: 70, PapaJohns: 77, total: 939 },
  "South West (England)": { Subway: 148, McDonalds: 106, Dominos: 112, KFC: 76, Nandos: 27, PapaJohns: 39, total: 508 },
  "Wales": { Subway: 84, McDonalds: 78, Dominos: 74, KFC: 47, Nandos: 15, PapaJohns: 6, total: 304 },
  "Scotland": { Subway: 191, McDonalds: 119, Dominos: 115, KFC: 62, Nandos: 35, PapaJohns: 18, total: 540 },
  "Northern Ireland": { Subway: 90, McDonalds: 36, Dominos: 49, KFC: 64, Nandos: 11, PapaJohns: 1, total: 251 },
};

// Brand point coordinates — real data from GeoJSON restaurant locations
export { BRAND_POINTS } from "./brand-points";

// Region centroids for map labels [lat, lng]
export const REGION_CENTROIDS: Record<string, [number, number]> = {
  "North East (England)": [55.0, -1.6],
  "North West (England)": [54.0, -2.7],
  "Yorkshire and The Humber": [53.8, -1.2],
  "East Midlands (England)": [52.8, -1.0],
  "West Midlands (England)": [52.5, -2.0],
  "East (England)": [52.2, 0.5],
  "London": [51.5, -0.12],
  "South East (England)": [51.2, 0.0],
  "South West (England)": [50.8, -3.2],
  "Wales": [52.0, -3.7],
  "Scotland": [56.8, -4.2],
  "Northern Ireland": [54.6, -6.8],
};

// Color interpolation for choropleth
export function interpolateColor(t: number): string {
  const colors = [
    [15, 23, 42],
    [30, 58, 138],
    [59, 130, 246],
    [96, 165, 250],
    [191, 219, 254],
  ];
  t = Math.max(0, Math.min(1, t));
  const idx = t * (colors.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  if (i >= colors.length - 1) return `rgb(${colors[colors.length - 1].join(',')})`;
  const c = colors[i].map((c, j) => Math.round(c + f * (colors[i + 1][j] - c)));
  return `rgb(${c.join(',')})`;
}
