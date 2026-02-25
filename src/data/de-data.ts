// Germany data — 16 Bundesländer, same 6 brands
// Synthetic but realistic distribution patterns

export const DE_POPULATION: Record<string, number> = {
  "Baden-Württemberg": 11103,
  "Bayern": 13140,
  "Berlin": 3645,
  "Brandenburg": 2531,
  "Bremen": 680,
  "Hamburg": 1853,
  "Hessen": 6293,
  "Mecklenburg-Vorpommern": 1611,
  "Niedersachsen": 8003,
  "Nordrhein-Westfalen": 17932,
  "Rheinland-Pfalz": 4098,
  "Saarland": 983,
  "Sachsen": 4057,
  "Sachsen-Anhalt": 2181,
  "Schleswig-Holstein": 2910,
  "Thüringen": 2121,
}

// Region counts — Subway and McDonalds stronger in Germany, PapaJohns weaker
export const DE_REGION_COUNTS: Record<string, Record<string, number>> = {
  "Baden-Württemberg": { Subway: 145, McDonalds: 168, Dominos: 95, KFC: 72, Nandos: 28, PapaJohns: 12, total: 520 },
  "Bayern": { Subway: 162, McDonalds: 198, Dominos: 108, KFC: 85, Nandos: 32, PapaJohns: 15, total: 600 },
  "Berlin": { Subway: 88, McDonalds: 72, Dominos: 65, KFC: 58, Nandos: 45, PapaJohns: 22, total: 350 },
  "Brandenburg": { Subway: 35, McDonalds: 42, Dominos: 22, KFC: 18, Nandos: 5, PapaJohns: 3, total: 125 },
  "Bremen": { Subway: 12, McDonalds: 14, Dominos: 8, KFC: 6, Nandos: 3, PapaJohns: 2, total: 45 },
  "Hamburg": { Subway: 48, McDonalds: 42, Dominos: 35, KFC: 28, Nandos: 18, PapaJohns: 9, total: 180 },
  "Hessen": { Subway: 95, McDonalds: 108, Dominos: 68, KFC: 52, Nandos: 22, PapaJohns: 10, total: 355 },
  "Mecklenburg-Vorpommern": { Subway: 22, McDonalds: 28, Dominos: 12, KFC: 10, Nandos: 2, PapaJohns: 1, total: 75 },
  "Niedersachsen": { Subway: 112, McDonalds: 128, Dominos: 72, KFC: 55, Nandos: 18, PapaJohns: 10, total: 395 },
  "Nordrhein-Westfalen": { Subway: 248, McDonalds: 278, Dominos: 168, KFC: 138, Nandos: 52, PapaJohns: 26, total: 910 },
  "Rheinland-Pfalz": { Subway: 55, McDonalds: 65, Dominos: 38, KFC: 28, Nandos: 8, PapaJohns: 6, total: 200 },
  "Saarland": { Subway: 14, McDonalds: 18, Dominos: 10, KFC: 8, Nandos: 3, PapaJohns: 2, total: 55 },
  "Sachsen": { Subway: 58, McDonalds: 68, Dominos: 42, KFC: 35, Nandos: 10, PapaJohns: 7, total: 220 },
  "Sachsen-Anhalt": { Subway: 28, McDonalds: 35, Dominos: 18, KFC: 15, Nandos: 4, PapaJohns: 3, total: 103 },
  "Schleswig-Holstein": { Subway: 42, McDonalds: 48, Dominos: 28, KFC: 22, Nandos: 8, PapaJohns: 5, total: 153 },
  "Thüringen": { Subway: 28, McDonalds: 35, Dominos: 18, KFC: 15, Nandos: 4, PapaJohns: 3, total: 103 },
}

export const DE_REGION_CENTROIDS: Record<string, [number, number]> = {
  "Baden-Württemberg": [48.66, 9.35],
  "Bayern": [48.79, 11.50],
  "Berlin": [52.52, 13.41],
  "Brandenburg": [52.41, 13.07],
  "Bremen": [53.08, 8.80],
  "Hamburg": [53.55, 9.99],
  "Hessen": [50.65, 9.16],
  "Mecklenburg-Vorpommern": [53.61, 12.43],
  "Niedersachsen": [52.64, 9.85],
  "Nordrhein-Westfalen": [51.43, 7.66],
  "Rheinland-Pfalz": [49.91, 7.45],
  "Saarland": [49.40, 7.02],
  "Sachsen": [51.10, 13.20],
  "Sachsen-Anhalt": [51.95, 11.69],
  "Schleswig-Holstein": [54.22, 9.70],
  "Thüringen": [50.98, 11.03],
}

export const DE_CITY_TO_REGION: Record<string, string> = {
  "Stuttgart": "Baden-Württemberg",
  "Karlsruhe": "Baden-Württemberg",
  "Mannheim": "Baden-Württemberg",
  "Freiburg": "Baden-Württemberg",
  "Heidelberg": "Baden-Württemberg",
  "Ulm": "Baden-Württemberg",
  "München": "Bayern",
  "Nürnberg": "Bayern",
  "Augsburg": "Bayern",
  "Regensburg": "Bayern",
  "Würzburg": "Bayern",
  "Ingolstadt": "Bayern",
  "Berlin": "Berlin",
  "Potsdam": "Brandenburg",
  "Cottbus": "Brandenburg",
  "Frankfurt (Oder)": "Brandenburg",
  "Bremen": "Bremen",
  "Bremerhaven": "Bremen",
  "Hamburg": "Hamburg",
  "Frankfurt": "Hessen",
  "Wiesbaden": "Hessen",
  "Kassel": "Hessen",
  "Darmstadt": "Hessen",
  "Offenbach": "Hessen",
  "Rostock": "Mecklenburg-Vorpommern",
  "Schwerin": "Mecklenburg-Vorpommern",
  "Hannover": "Niedersachsen",
  "Braunschweig": "Niedersachsen",
  "Osnabrück": "Niedersachsen",
  "Oldenburg": "Niedersachsen",
  "Göttingen": "Niedersachsen",
  "Wolfsburg": "Niedersachsen",
  "Köln": "Nordrhein-Westfalen",
  "Düsseldorf": "Nordrhein-Westfalen",
  "Dortmund": "Nordrhein-Westfalen",
  "Essen": "Nordrhein-Westfalen",
  "Duisburg": "Nordrhein-Westfalen",
  "Bochum": "Nordrhein-Westfalen",
  "Wuppertal": "Nordrhein-Westfalen",
  "Bielefeld": "Nordrhein-Westfalen",
  "Bonn": "Nordrhein-Westfalen",
  "Münster": "Nordrhein-Westfalen",
  "Aachen": "Nordrhein-Westfalen",
  "Mainz": "Rheinland-Pfalz",
  "Ludwigshafen": "Rheinland-Pfalz",
  "Koblenz": "Rheinland-Pfalz",
  "Trier": "Rheinland-Pfalz",
  "Saarbrücken": "Saarland",
  "Leipzig": "Sachsen",
  "Dresden": "Sachsen",
  "Chemnitz": "Sachsen",
  "Magdeburg": "Sachsen-Anhalt",
  "Halle": "Sachsen-Anhalt",
  "Kiel": "Schleswig-Holstein",
  "Lübeck": "Schleswig-Holstein",
  "Flensburg": "Schleswig-Holstein",
  "Erfurt": "Thüringen",
  "Jena": "Thüringen",
  "Gera": "Thüringen",
}

export function deInterpolateColor(t: number): string {
  // Blue-to-amber palette for Germany (distinct from UK's blue palette)
  const colors = [
    [15, 23, 42],
    [30, 64, 110],
    [59, 130, 180],
    [180, 160, 80],
    [245, 180, 60],
  ]
  t = Math.max(0, Math.min(1, t))
  const idx = t * (colors.length - 1)
  const i = Math.floor(idx)
  const f = idx - i
  if (i >= colors.length - 1) return `rgb(${colors[colors.length - 1].join(",")})`
  const c = colors[i].map((c, j) => Math.round(c + f * (colors[i + 1][j] - c)))
  return `rgb(${c.join(",")})`
}
