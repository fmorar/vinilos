import { promises as fs } from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "data");
const CACHE_PATH = path.join(CACHE_DIR, "cover-cache.json");

export type HitEntry = {
  url: string;
  source: string;
  ts: number;
};

const hitCache = new Map<string, HitEntry>();
const missCache = new Map<string, number>();
const MISS_TTL_MS = 1000 * 60 * 5;

let loaded = false;
let loadPromise: Promise<void> | null = null;
let writeTimer: NodeJS.Timeout | null = null;
let dirty = false;

async function loadFromDisk(): Promise<void> {
  if (loaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await fs.readFile(CACHE_PATH, "utf-8");
      const obj = JSON.parse(raw) as Record<string, HitEntry>;
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v.url === "string" && v.url.length > 0) {
          hitCache.set(k, v);
        }
      }
      console.log(`[coverCache] loaded ${hitCache.size} entries from disk`);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") {
        console.warn("[coverCache] could not read cache file:", err);
      }
    }
    loaded = true;
  })();
  return loadPromise;
}

async function flushToDisk(): Promise<void> {
  if (!dirty) return;
  dirty = false;
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const obj: Record<string, HitEntry> = {};
    for (const [k, v] of hitCache) obj[k] = v;
    const tmp = CACHE_PATH + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf-8");
    await fs.rename(tmp, CACHE_PATH);
  } catch (err) {
    console.error("[coverCache] failed to persist:", err);
    dirty = true;
  }
}

function scheduleFlush() {
  dirty = true;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void flushToDisk();
  }, 2000);
}

export async function getCachedHit(key: string): Promise<HitEntry | null> {
  await loadFromDisk();
  return hitCache.get(key) ?? null;
}

export function getRecentMiss(key: string): boolean {
  const ts = missCache.get(key);
  if (!ts) return false;
  if (Date.now() - ts < MISS_TTL_MS) return true;
  missCache.delete(key);
  return false;
}

export async function setHit(key: string, url: string, source: string) {
  await loadFromDisk();
  hitCache.set(key, { url, source, ts: Date.now() });
  missCache.delete(key);
  scheduleFlush();
}

export function setMiss(key: string) {
  missCache.set(key, Date.now());
}

export async function getStats() {
  await loadFromDisk();
  return {
    hits: hitCache.size,
    recentMisses: missCache.size,
    cachePath: CACHE_PATH,
  };
}
