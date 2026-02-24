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

// Region counts extracted from TopoJSON properties
export const REGION_COUNTS: Record<string, Record<string, number>> = {
  "North East (England)": { Subway: 92, McDonalds: 63, Dominos: 45, KFC: 36, Nandos: 17, PapaJohns: 7, total: 260 },
  "North West (England)": { Subway: 293, McDonalds: 192, Dominos: 135, KFC: 121, Nandos: 51, PapaJohns: 26, total: 818 },
  "Yorkshire and The Humber": { Subway: 156, McDonalds: 115, Dominos: 86, KFC: 77, Nandos: 31, PapaJohns: 19, total: 484 },
  "East Midlands (England)": { Subway: 154, McDonalds: 123, Dominos: 102, KFC: 64, Nandos: 22, PapaJohns: 39, total: 504 },
  "West Midlands (England)": { Subway: 213, McDonalds: 137, Dominos: 107, KFC: 93, Nandos: 36, PapaJohns: 46, total: 632 },
  "East (England)": { Subway: 190, McDonalds: 150, Dominos: 138, KFC: 88, Nandos: 42, PapaJohns: 52, total: 660 },
  "London": { Subway: 216, McDonalds: 183, Dominos: 149, KFC: 155, Nandos: 127, PapaJohns: 84, total: 914 },
  "South East (England)": { Subway: 285, McDonalds: 207, Dominos: 201, KFC: 143, Nandos: 78, PapaJohns: 73, total: 987 },
  "South West (England)": { Subway: 176, McDonalds: 112, Dominos: 131, KFC: 67, Nandos: 29, PapaJohns: 21, total: 536 },
  "Wales": { Subway: 100, McDonalds: 76, Dominos: 67, KFC: 55, Nandos: 21, PapaJohns: 10, total: 329 },
  "Scotland": { Subway: 129, McDonalds: 100, Dominos: 168, KFC: 84, Nandos: 21, PapaJohns: 15, total: 517 },
  "Northern Ireland": { Subway: 59, McDonalds: 50, Dominos: 4, KFC: 54, Nandos: 9, PapaJohns: 5, total: 181 },
};

// Sample brand point coordinates [lat, lng, address, city, postcode]
export const BRAND_POINTS: Record<string, [number, number, string, string, string][]> = {
  Subway: [
    [51.5074, -0.1278, "1 High St", "London", "EC1A"],
    [53.4808, -2.2426, "2 Market St", "Manchester", "M1 1"],
    [52.4862, -1.8904, "3 New St", "Birmingham", "B1 1"],
    [55.9533, -3.1883, "4 Princes St", "Edinburgh", "EH1"],
    [51.4545, -2.5879, "5 Park St", "Bristol", "BS1"],
    [53.8008, -1.5491, "6 Briggate", "Leeds", "LS1"],
  ],
  McDonalds: [
    [51.5155, -0.1419, "10 Oxford St", "London", "W1D"],
    [53.4723, -2.2398, "11 Piccadilly", "Manchester", "M1 2"],
    [52.4796, -1.9026, "12 Bull Ring", "Birmingham", "B5 4"],
    [55.9412, -3.1905, "13 South Bridge", "Edinburgh", "EH1"],
    [53.3811, -1.4701, "14 Fargate", "Sheffield", "S1 2"],
  ],
  Dominos: [
    [51.5225, -0.1302, "20 Euston Rd", "London", "NW1"],
    [53.4631, -2.2494, "21 Oxford Rd", "Manchester", "M13"],
    [52.4539, -1.7481, "22 Coventry Rd", "Birmingham", "B26"],
    [55.8642, -4.2518, "23 Sauchiehall St", "Glasgow", "G2 3"],
  ],
  KFC: [
    [51.5090, -0.1260, "30 Strand", "London", "WC2R"],
    [53.4775, -2.2316, "31 Portland St", "Manchester", "M1 3"],
    [52.4862, -1.8938, "32 Corp St", "Birmingham", "B4 6"],
    [51.4519, -2.5966, "33 Union St", "Bristol", "BS1"],
  ],
  Nandos: [
    [51.5117, -0.1185, "40 Cheapside", "London", "EC2V"],
    [53.4740, -2.2528, "41 Deansgate", "Manchester", "M3 4"],
    [52.4800, -1.8960, "42 New St", "Birmingham", "B2 4"],
  ],
  PapaJohns: [
    [51.5200, -0.1400, "50 Tottenham Ct Rd", "London", "W1T"],
    [53.4700, -2.2400, "51 Whitworth St", "Manchester", "M1 5"],
  ],
};

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
