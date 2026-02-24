/**
 * Generates realistic restaurant location points distributed across UK cities.
 * Points are weighted by city population within each region, with gaussian
 * noise added around city centers to create natural-looking clusters.
 */

import { writeFileSync } from "fs";

// Major UK cities per region: [lat, lng, name, population_weight, postcode_prefix]
const CITIES_BY_REGION = {
  "North East (England)": [
    [54.9783, -1.6178, "Newcastle", 40, "NE"],
    [54.5680, -1.2341, "Middlesbrough", 15, "TS"],
    [54.7753, -1.5849, "Durham", 8, "DH"],
    [54.9069, -1.3838, "Sunderland", 20, "SR"],
    [54.6862, -1.2123, "Stockton", 10, "TS"],
    [55.0077, -1.4519, "Whitley Bay", 4, "NE"],
    [54.8615, -1.7296, "Consett", 3, "DH"],
  ],
  "North West (England)": [
    [53.4808, -2.2426, "Manchester", 35, "M"],
    [53.4084, -2.9916, "Liverpool", 25, "L"],
    [53.7676, -2.7148, "Preston", 8, "PR"],
    [53.5228, -2.1106, "Oldham", 5, "OL"],
    [53.3900, -2.5970, "Warrington", 6, "WA"],
    [53.5933, -2.2966, "Bolton", 7, "BL"],
    [54.0466, -2.7998, "Lancaster", 3, "LA"],
    [53.2326, -2.6103, "Chester", 5, "CH"],
    [54.1109, -3.2266, "Barrow", 3, "LA"],
    [53.6458, -1.7850, "Huddersfield", 3, "HD"],
  ],
  "Yorkshire and The Humber": [
    [53.8008, -1.5491, "Leeds", 30, "LS"],
    [53.3811, -1.4701, "Sheffield", 25, "S"],
    [53.7457, -0.3367, "Hull", 12, "HU"],
    [53.5933, -1.0131, "Doncaster", 8, "DN"],
    [53.8431, -1.7585, "Bradford", 12, "BD"],
    [53.6930, -1.6351, "Wakefield", 5, "WF"],
    [53.9576, -1.0827, "York", 5, "YO"],
    [54.0954, -0.1310, "Scarborough", 3, "YO"],
  ],
  "East Midlands (England)": [
    [52.9548, -1.1581, "Nottingham", 28, "NG"],
    [52.6369, -1.1398, "Leicester", 22, "LE"],
    [52.9212, -1.4757, "Derby", 15, "DE"],
    [53.2327, -0.5389, "Lincoln", 8, "LN"],
    [52.3995, -0.7294, "Northampton", 12, "NN"],
    [52.5597, -0.2389, "Peterborough", 8, "PE"],
    [52.7676, -1.2000, "Loughborough", 4, "LE"],
    [53.1388, -1.1964, "Mansfield", 3, "NG"],
  ],
  "West Midlands (England)": [
    [52.4862, -1.8904, "Birmingham", 40, "B"],
    [52.5862, -2.1229, "Wolverhampton", 12, "WV"],
    [52.4100, -1.5197, "Coventry", 15, "CV"],
    [52.6799, -2.4451, "Telford", 6, "TF"],
    [52.6862, -1.8266, "Walsall", 8, "WS"],
    [52.5091, -2.0843, "Dudley", 7, "DY"],
    [52.5105, -1.9362, "West Bromwich", 4, "B"],
    [52.1917, -2.2214, "Worcester", 5, "WR"],
    [52.6220, -1.1253, "Hinckley", 3, "LE"],
  ],
  "East (England)": [
    [51.7520, 0.4724, "Southend", 10, "SS"],
    [52.2053, 0.1218, "Cambridge", 10, "CB"],
    [51.7343, -0.4648, "St Albans", 8, "AL"],
    [52.6309, 1.2974, "Norwich", 12, "NR"],
    [51.8787, 0.5546, "Chelmsford", 8, "CM"],
    [52.0579, 1.1437, "Ipswich", 8, "IP"],
    [51.7637, -0.2270, "Welwyn", 5, "AL"],
    [51.8860, -0.4161, "Luton", 12, "LU"],
    [52.4047, -0.7277, "Kettering", 5, "NN"],
    [51.7528, -0.3398, "Watford", 10, "WD"],
    [51.6279, 0.1746, "Romford", 12, "RM"],
  ],
  "London": [
    [51.5074, -0.1278, "Central London", 20, "EC"],
    [51.5155, -0.1419, "West End", 15, "W1"],
    [51.5248, -0.0777, "City / Shoreditch", 10, "EC"],
    [51.4613, -0.1156, "Brixton", 6, "SW"],
    [51.5426, -0.0040, "Stratford", 8, "E15"],
    [51.4603, -0.3005, "Richmond", 4, "TW"],
    [51.5528, -0.1045, "Islington", 5, "N1"],
    [51.4720, -0.0013, "Greenwich", 5, "SE10"],
    [51.5818, -0.0070, "Walthamstow", 4, "E17"],
    [51.4426, -0.0736, "Lewisham", 5, "SE13"],
    [51.4923, -0.2255, "Hammersmith", 4, "W6"],
    [51.5854, -0.0712, "Tottenham", 4, "N17"],
    [51.4014, -0.0178, "Croydon", 7, "CR"],
    [51.5516, -0.1782, "Camden", 3, "NW1"],
  ],
  "South East (England)": [
    [50.8198, -0.1370, "Brighton", 12, "BN"],
    [51.2686, -1.0884, "Basingstoke", 6, "RG"],
    [51.4543, -0.9781, "Reading", 10, "RG"],
    [51.2802, 1.0789, "Canterbury", 5, "CT"],
    [50.7989, -1.0912, "Portsmouth", 10, "PO"],
    [50.9097, -1.4044, "Southampton", 10, "SO"],
    [51.3492, -0.7440, "Bracknell", 4, "RG"],
    [51.2787, -0.5217, "Guildford", 6, "GU"],
    [51.3811, 0.5075, "Chatham", 6, "ME"],
    [51.1142, -0.8270, "Farnham", 4, "GU"],
    [51.1537, 1.3050, "Dover", 3, "CT"],
    [51.2712, -0.2102, "Crawley", 5, "RH"],
    [51.7547, -1.2540, "Oxford", 8, "OX"],
    [51.6205, -0.7533, "High Wycombe", 5, "HP"],
    [51.3868, -0.3699, "Epsom", 3, "KT"],
    [51.1589, -0.1718, "Horley", 3, "RH"],
  ],
  "South West (England)": [
    [51.4545, -2.5879, "Bristol", 25, "BS"],
    [50.7184, -3.5339, "Exeter", 10, "EX"],
    [50.3755, -4.1427, "Plymouth", 12, "PL"],
    [50.7200, -1.8800, "Bournemouth", 10, "BH"],
    [51.5560, -1.7799, "Swindon", 8, "SN"],
    [51.3811, -2.3590, "Bath", 5, "BA"],
    [51.2601, -2.1945, "Frome", 2, "BA"],
    [50.2660, -5.0527, "Truro", 3, "TR"],
    [51.0500, -2.6333, "Yeovil", 3, "BA"],
    [50.6080, -2.4570, "Weymouth", 3, "DT"],
    [50.4619, -3.5253, "Torquay", 5, "TQ"],
    [51.0632, -1.3081, "Salisbury", 4, "SP"],
    [51.8994, -2.0783, "Gloucester", 7, "GL"],
    [51.8643, -2.2382, "Cheltenham", 3, "GL"],
  ],
  "Wales": [
    [51.4816, -3.1791, "Cardiff", 30, "CF"],
    [51.6208, -3.9432, "Swansea", 18, "SA"],
    [51.5842, -2.9977, "Newport", 12, "NP"],
    [53.2274, -3.1675, "Llandudno", 5, "LL"],
    [51.6572, -3.3863, "Merthyr Tydfil", 5, "CF"],
    [51.6695, -3.4372, "Aberdare", 3, "CF"],
    [53.2326, -4.1296, "Bangor", 3, "LL"],
    [51.8094, -3.0089, "Abergavenny", 3, "NP"],
    [52.5847, -3.1339, "Newtown", 2, "SY"],
    [51.4032, -3.2870, "Barry", 6, "CF"],
    [51.7429, -3.3808, "Ebbw Vale", 3, "NP"],
    [51.6740, -3.2497, "Pontypool", 5, "NP"],
    [52.4140, -4.0812, "Aberystwyth", 2, "SY"],
    [51.5005, -3.5653, "Bridgend", 3, "CF"],
  ],
  "Scotland": [
    [55.9533, -3.1883, "Edinburgh", 25, "EH"],
    [55.8642, -4.2518, "Glasgow", 30, "G"],
    [57.1497, -2.0943, "Aberdeen", 12, "AB"],
    [56.4620, -2.9707, "Dundee", 8, "DD"],
    [56.1165, -3.9369, "Stirling", 4, "FK"],
    [55.9024, -3.3889, "Livingston", 4, "EH"],
    [55.7964, -4.0311, "East Kilbride", 4, "G"],
    [56.0000, -3.7833, "Falkirk", 4, "FK"],
    [55.8531, -4.3277, "Paisley", 4, "PA"],
    [55.0100, -7.3194, "Derry approach", 2, "BT"],
    [56.3398, -2.7967, "St Andrews", 2, "KY"],
    [57.4778, -4.2247, "Inverness", 3, "IV"],
  ],
  "Northern Ireland": [
    [54.5973, -5.9301, "Belfast", 40, "BT"],
    [54.3503, -6.6528, "Armagh", 5, "BT"],
    [55.0059, -7.3186, "Derry", 15, "BT"],
    [54.3429, -7.6322, "Enniskillen", 5, "BT"],
    [54.6510, -5.6706, "Bangor NI", 8, "BT"],
    [54.5148, -6.0355, "Lisburn", 10, "BT"],
    [54.6608, -5.6700, "Holywood", 3, "BT"],
    [54.5810, -5.9351, "East Belfast", 8, "BT"],
    [54.4625, -6.1670, "Hillsborough", 3, "BT"],
    [54.4525, -5.6070, "Downpatrick", 3, "BT"],
  ],
};

const REGION_COUNTS = {
  "North East (England)": { Subway: 92, McDonalds: 63, Dominos: 45, KFC: 36, Nandos: 17, PapaJohns: 7 },
  "North West (England)": { Subway: 293, McDonalds: 192, Dominos: 135, KFC: 121, Nandos: 51, PapaJohns: 26 },
  "Yorkshire and The Humber": { Subway: 156, McDonalds: 115, Dominos: 86, KFC: 77, Nandos: 31, PapaJohns: 19 },
  "East Midlands (England)": { Subway: 154, McDonalds: 123, Dominos: 102, KFC: 64, Nandos: 22, PapaJohns: 39 },
  "West Midlands (England)": { Subway: 213, McDonalds: 137, Dominos: 107, KFC: 93, Nandos: 36, PapaJohns: 46 },
  "East (England)": { Subway: 190, McDonalds: 150, Dominos: 138, KFC: 88, Nandos: 42, PapaJohns: 52 },
  "London": { Subway: 216, McDonalds: 183, Dominos: 149, KFC: 155, Nandos: 127, PapaJohns: 84 },
  "South East (England)": { Subway: 285, McDonalds: 207, Dominos: 201, KFC: 143, Nandos: 78, PapaJohns: 73 },
  "South West (England)": { Subway: 176, McDonalds: 112, Dominos: 131, KFC: 67, Nandos: 29, PapaJohns: 21 },
  "Wales": { Subway: 100, McDonalds: 76, Dominos: 67, KFC: 55, Nandos: 21, PapaJohns: 10 },
  "Scotland": { Subway: 129, McDonalds: 100, Dominos: 168, KFC: 84, Nandos: 21, PapaJohns: 15 },
  "Northern Ireland": { Subway: 59, McDonalds: 50, Dominos: 4, KFC: 54, Nandos: 9, PapaJohns: 5 },
};

const STREET_NAMES = [
  "High St", "Market St", "Church St", "Station Rd", "Mill Rd",
  "Park Ave", "Victoria Rd", "King St", "Queen St", "Bridge St",
  "London Rd", "Castle St", "New St", "North Rd", "South St",
  "West St", "East St", "George St", "Albert Rd", "Commercial Rd",
  "Oxford St", "York Rd", "Green Ln", "Main St", "Cross St",
  "Union St", "Stanley Rd", "Forest Rd", "Manor Rd", "Broad St",
];

// Seeded pseudo-random for reproducibility
let seed = 42;
function random() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}

// Box-Muller gaussian noise
function gaussian(mean, stddev) {
  const u1 = random();
  const u2 = random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stddev + mean;
}

function distributeCount(count, cities) {
  const totalWeight = cities.reduce((sum, c) => sum + c[3], 0);
  const result = cities.map((c) => ({
    city: c,
    count: Math.floor((c[3] / totalWeight) * count),
  }));

  // Distribute remainder
  let remaining = count - result.reduce((sum, r) => sum + r.count, 0);
  let idx = 0;
  while (remaining > 0) {
    result[idx % result.length].count++;
    remaining--;
    idx++;
  }

  return result;
}

function generatePoints() {
  const brandPoints = {};

  for (const [region, counts] of Object.entries(REGION_COUNTS)) {
    const cities = CITIES_BY_REGION[region];
    if (!cities) continue;

    for (const [brand, count] of Object.entries(counts)) {
      if (!brandPoints[brand]) brandPoints[brand] = [];

      const distribution = distributeCount(count, cities);

      for (const { city, count: cityCount } of distribution) {
        const [lat, lng, cityName, , postcodePrefix] = city;
        // Spread radius: smaller for dense cities, larger for smaller towns
        const spread = cityName.includes("Central") || cityName.includes("West End")
          ? 0.012
          : 0.025;

        for (let i = 0; i < cityCount; i++) {
          const pLat = parseFloat(gaussian(lat, spread).toFixed(5));
          const pLng = parseFloat(gaussian(lng, spread * 1.5).toFixed(5));
          const streetNum = Math.floor(random() * 200) + 1;
          const street = STREET_NAMES[Math.floor(random() * STREET_NAMES.length)];
          const postcodeNum = Math.floor(random() * 30) + 1;

          brandPoints[brand].push([
            pLat,
            pLng,
            `${streetNum} ${street}`,
            cityName,
            `${postcodePrefix}${postcodeNum}`,
          ]);
        }
      }
    }
  }

  return brandPoints;
}

const points = generatePoints();

// Count totals
let total = 0;
for (const [brand, pts] of Object.entries(points)) {
  total += pts.length;
  process.stderr.write(`${brand}: ${pts.length} points\n`);
}
process.stderr.write(`Total: ${total} points\n`);

// Generate TypeScript file
let ts = `// Auto-generated restaurant location data (~${total.toLocaleString()} points)
// Distributed across UK cities proportional to population
// Format: [lat, lng, address, city, postcode]

type BrandPoint = [number, number, string, string, string];

export const BRAND_POINTS: Record<string, BrandPoint[]> = {\n`;

for (const [brand, pts] of Object.entries(points)) {
  ts += `  ${brand}: [\n`;
  for (const p of pts) {
    ts += `    [${p[0]},${p[1]},"${p[2]}","${p[3]}","${p[4]}"],\n`;
  }
  ts += `  ],\n`;
}

ts += `};\n`;

writeFileSync("src/data/brand-points.ts", ts);
process.stderr.write("Written to src/data/brand-points.ts\n");
