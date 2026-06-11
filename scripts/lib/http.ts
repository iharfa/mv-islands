import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DELAY_MS = Number(process.env.SCRAPER_DELAY_MS ?? 1500);
const MAX_RETRIES = Number(process.env.SCRAPER_MAX_RETRIES ?? 3);
const CACHE_DIR = path.join(process.cwd(), "data", "cache");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastRequestAt = 0;

export interface FetchResult {
  url: string;
  status: number;
  body: string;
  fromCache: boolean;
  fetchedAt: string;
  contentHash: string;
}

function cacheKey(url: string): string {
  return crypto.createHash("sha1").update(url).digest("hex");
}

/**
 * Polite fetch: rate-limited, cached on disk, retried with exponential backoff.
 * Responses are cached under data/cache so repeated runs never hammer sources.
 */
export async function politeFetch(
  url: string,
  opts: { useCache?: boolean; headers?: Record<string, string> } = {},
): Promise<FetchResult> {
  const useCache = opts.useCache ?? true;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, cacheKey(url) + ".json");

  if (useCache && fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    return { ...cached, fromCache: true };
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const wait = Math.max(0, lastRequestAt + DELAY_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "MaldivesIslandRegistryBot/1.0 (+open data archive; Coalition for Open Governance)",
          ...opts.headers,
        },
        signal: AbortSignal.timeout(60000),
      });
      const body = await res.text();
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        await sleep(2 ** attempt * 2000);
        continue;
      }
      const result: FetchResult = {
        url,
        status: res.status,
        body,
        fromCache: false,
        fetchedAt: new Date().toISOString(),
        contentHash: crypto.createHash("sha256").update(body).digest("hex"),
      };
      if (res.ok) fs.writeFileSync(cachePath, JSON.stringify(result));
      return result;
    } catch (err) {
      lastError = err;
      await sleep(2 ** attempt * 2000);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${MAX_RETRIES + 1} attempts: ${lastError}`);
}

/** Polite binary fetch (XLSX, images). Rate-limited and disk-cached like politeFetch. */
export async function politeFetchBinary(url: string): Promise<{ url: string; status: number; buffer: Buffer; fetchedAt: string }> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, cacheKey(url) + ".bin");
  const metaPath = cachePath + ".meta.json";
  if (fs.existsSync(cachePath) && fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    return { url, status: meta.status, buffer: fs.readFileSync(cachePath), fetchedAt: meta.fetchedAt };
  }
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const wait = Math.max(0, lastRequestAt + DELAY_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "MaldivesIslandRegistryBot/1.0 (+open data archive; Coalition for Open Governance)" },
        signal: AbortSignal.timeout(120000),
      });
      const buffer = Buffer.from(await res.arrayBuffer());
      if (res.status >= 500 && attempt < MAX_RETRIES) { await sleep(2 ** attempt * 2000); continue; }
      if (res.ok) {
        fs.writeFileSync(cachePath, buffer);
        fs.writeFileSync(metaPath, JSON.stringify({ status: res.status, fetchedAt: new Date().toISOString() }));
      }
      return { url, status: res.status, buffer, fetchedAt: new Date().toISOString() };
    } catch (err) {
      lastError = err;
      await sleep(2 ** attempt * 2000);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${MAX_RETRIES + 1} attempts: ${lastError}`);
}

/** Archive a raw payload under data/raw/<sourceDir>/, returning the relative path. */
export function archiveRaw(sourceDir: string, filename: string, content: string | Buffer): string {
  const dir = path.join(process.cwd(), "data", "raw", sourceDir);
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, filename);
  fs.writeFileSync(full, content);
  return path.relative(process.cwd(), full).replace(/\\/g, "/");
}

export function safeFilename(input: string): string {
  return input.replace(/https?:\/\//, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
}
