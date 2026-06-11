/** Shared normalization helpers for island matching across sources. */

export interface AtollDef {
  code: string;
  name: string; // common administrative name
  naturalName: string; // traditional/natural atoll name used by Atolls of Maldives
}

// The 20 administrative atolls + Male' region. `naturalName` matches the
// Atolls of Maldives URL/heading naming.
export const ATOLLS: AtollDef[] = [
  { code: "HA", name: "Haa Alifu", naturalName: "Thiladhunmathi Uthuruburi" },
  { code: "HDh", name: "Haa Dhaalu", naturalName: "Thiladhunmathi Dhekunuburi" },
  { code: "Sh", name: "Shaviyani", naturalName: "Miladhunmadulu Uthuruburi" },
  { code: "N", name: "Noonu", naturalName: "Miladhunmadulu Dhekunuburi" },
  { code: "R", name: "Raa", naturalName: "Maalhosmadulu Uthuruburi" },
  { code: "B", name: "Baa", naturalName: "Maalhosmadulu Dhekunuburi" },
  { code: "Lh", name: "Lhaviyani", naturalName: "Faadhippolhu" },
  { code: "K", name: "Kaafu", naturalName: "Male' Atholhu" },
  { code: "AA", name: "Alifu Alifu", naturalName: "Ari Atholhu Uthuruburi" },
  { code: "ADh", name: "Alifu Dhaalu", naturalName: "Ari Atholhu Dhekunuburi" },
  { code: "V", name: "Vaavu", naturalName: "Felidhe Atholhu" },
  { code: "M", name: "Meemu", naturalName: "Mulaku Atholhu" },
  { code: "F", name: "Faafu", naturalName: "Nilandhe Atholhu Uthuruburi" },
  { code: "Dh", name: "Dhaalu", naturalName: "Nilandhe Atholhu Dhekunuburi" },
  { code: "Th", name: "Thaa", naturalName: "Kolhumadulu" },
  { code: "L", name: "Laamu", naturalName: "Hadhdhunmathi" },
  { code: "GA", name: "Gaafu Alifu", naturalName: "Huvadhu Atholhu Uthuruburi" },
  { code: "GDh", name: "Gaafu Dhaalu", naturalName: "Huvadhu Atholhu Dhekunuburi" },
  { code: "Gn", name: "Gnaviyani", naturalName: "Fuvahmulah" },
  { code: "S", name: "Seenu", naturalName: "Addu Atholhu" },
  { code: "Male", name: "Male' Region", naturalName: "Male' Region" },
];

const ATOLL_LOOKUP = new Map<string, AtollDef>();
for (const a of ATOLLS) {
  ATOLL_LOOKUP.set(a.code.toLowerCase(), a);
  ATOLL_LOOKUP.set(normalizeName(a.name), a);
  ATOLL_LOOKUP.set(normalizeName(a.naturalName), a);
}
// Aliases seen in the wild
const ALIASES: Record<string, string> = {
  "alif alif": "AA", "alif dhaal": "ADh", "alifu dhaalu": "ADh", "north ari atoll": "AA",
  "south ari atoll": "ADh", "male": "K", "kaafu atoll": "K", "north thiladhunmathi": "HA",
  "south thiladhunmathi": "HDh", "north miladhunmadulu": "Sh", "south miladhunmadulu": "N",
  "north maalhosmadulu": "R", "south maalhosmadulu": "B", "faadhippolhu": "Lh",
  "felidhu atoll": "V", "mulakatholhu": "M", "north nilandhe atoll": "F",
  "south nilandhe atoll": "Dh", "kolhumadulu": "Th", "hadhdhunmathi": "L",
  "north huvadhu atoll": "GA", "south huvadhu atoll": "GDh", "fuvahmulah": "Gn",
  "addu": "S", "addu city": "S", "seenu": "S", "vaavu": "V", "GN": "Gn", "gn": "Gn",
};

export function resolveAtoll(input: string | null | undefined): AtollDef | null {
  if (!input) return null;
  const raw = input.trim();
  const direct = ATOLL_LOOKUP.get(raw.toLowerCase()) ?? ATOLL_LOOKUP.get(normalizeName(raw));
  if (direct) return direct;
  const alias = ALIASES[normalizeName(raw)] ?? ALIASES[raw];
  if (alias) return ATOLL_LOOKUP.get(alias.toLowerCase()) ?? null;
  // "Thiladhunmathi Uthuruburi (Haa Alifu Atoll)" → inner parens name
  const paren = raw.match(/\(([^)]+?)\s*Atoll\)/i);
  if (paren) return resolveAtoll(paren[1]);
  return null;
}

/** Aggressive name normalization for cross-source matching. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`´]/g, "")
    .replace(/\s*\((i|u|r)\)\s*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Levenshtein distance for fuzzy matching. */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[m][n];
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a), nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

/** Parse DMS like `6° 50' 55'' N` or `73° 9' 7.5" E` to decimal degrees. */
export function parseDms(input: string | null | undefined): number | null {
  if (!input) return null;
  const m = String(input)
    .replace(/&deg;/g, "°")
    .match(/(-?\d+(?:\.\d+)?)\s*°\s*(?:(\d+(?:\.\d+)?)\s*['′])?\s*(?:(\d+(?:\.\d+)?)\s*(?:''|"|″|′′))?\s*([NSEW])?/i);
  if (!m) {
    const dec = Number(input);
    return Number.isFinite(dec) ? dec : null;
  }
  let v = Number(m[1]) + (Number(m[2] ?? 0) / 60) + (Number(m[3] ?? 0) / 3600);
  if (m[4] && /[SW]/i.test(m[4])) v = -v;
  return Math.round(v * 1e6) / 1e6;
}

export function slugify(name: string, atollCode?: string | null): string {
  const base = normalizeName(name).replace(/\s+/g, "-");
  return atollCode ? `${atollCode.toLowerCase()}-${base}` : base;
}

/** Haversine distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
