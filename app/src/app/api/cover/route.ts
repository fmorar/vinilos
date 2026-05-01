import { NextRequest } from "next/server";
import { getCachedHit, getRecentMiss, setHit, setMiss } from "../../../lib/coverCache";

type DiscogsImage = { type?: string; uri?: string; uri150?: string };
type DiscogsRelease = { images?: DiscogsImage[] };
type DiscogsSearchResult = { cover_image?: string; thumb?: string };
type DiscogsSearchResponse = { results?: DiscogsSearchResult[] };

type ItunesResult = { artworkUrl100?: string };
type ItunesResponse = { resultCount: number; results: ItunesResult[] };

const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
const UA = "vinilos-catalog/1.0";

const DISCOGS_MIN_INTERVAL_MS = 1100;
let discogsNextAvailableAt = 0;
async function waitForDiscogsSlot(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, discogsNextAvailableAt - now);
  discogsNextAvailableAt = Math.max(now, discogsNextAvailableAt) + DISCOGS_MIN_INTERVAL_MS;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

function clean(s: string): string {
  return s
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[／\/].*$/, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type LookupResult = { url: string | null; throttled: boolean };

async function fetchDiscogsByDid(did: string): Promise<LookupResult> {
  if (!DISCOGS_TOKEN || !did) return { url: null, throttled: false };
  try {
    await waitForDiscogsSlot();
    const res = await fetch(`https://api.discogs.com/releases/${encodeURIComponent(did)}`, {
      next: { revalidate: 60 * 60 * 24 * 30 },
      headers: {
        "User-Agent": UA,
        Authorization: `Discogs token=${DISCOGS_TOKEN}`,
      },
    });
    if (res.status === 429) return { url: null, throttled: true };
    if (!res.ok) return { url: null, throttled: false };
    const data = (await res.json()) as DiscogsRelease;
    const primary = data.images?.find((i) => i.type === "primary");
    return { url: primary?.uri ?? data.images?.[0]?.uri ?? null, throttled: false };
  } catch {
    return { url: null, throttled: false };
  }
}

async function searchDiscogs(artista: string, titulo: string): Promise<LookupResult> {
  if (!DISCOGS_TOKEN) return { url: null, throttled: false };
  const a = clean(artista);
  const t = clean(titulo);
  if (!a && !t) return { url: null, throttled: false };
  const params = new URLSearchParams({
    type: "release",
    per_page: "1",
  });
  if (a) params.set("artist", a);
  if (t) params.set("release_title", t);
  try {
    await waitForDiscogsSlot();
    const res = await fetch(`https://api.discogs.com/database/search?${params.toString()}`, {
      next: { revalidate: 60 * 60 * 24 * 30 },
      headers: {
        "User-Agent": UA,
        Authorization: `Discogs token=${DISCOGS_TOKEN}`,
      },
    });
    if (res.status === 429) return { url: null, throttled: true };
    if (!res.ok) return { url: null, throttled: false };
    const data = (await res.json()) as DiscogsSearchResponse;
    return {
      url: data.results?.[0]?.cover_image ?? data.results?.[0]?.thumb ?? null,
      throttled: false,
    };
  } catch {
    return { url: null, throttled: false };
  }
}

async function searchItunes(term: string): Promise<string | null> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term
  )}&entity=album&limit=1&media=music`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 * 30 },
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ItunesResponse;
    const art = data.results?.[0]?.artworkUrl100;
    if (!art) return null;
    return art.replace("100x100bb", "600x600bb");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const artista = (sp.get("artista") || "").trim();
  const titulo = (sp.get("titulo") || "").trim();
  const did = (sp.get("did") || "").trim();

  if (!did && !artista && !titulo) {
    return Response.json({ url: null, source: "none" }, { status: 400 });
  }

  const force = sp.get("refresh") === "1";
  const key = `${did}::${artista.toLowerCase()}::${titulo.toLowerCase()}`;

  if (!force) {
    const hit = await getCachedHit(key);
    if (hit) {
      return Response.json(
        { url: hit.url, source: hit.source, cached: true },
        { headers: { "Cache-Control": "public, max-age=2592000, immutable" } }
      );
    }
    if (getRecentMiss(key)) {
      return Response.json(
        { url: null, source: "miss-cached", cached: true },
        { headers: { "Cache-Control": "public, max-age=300" } }
      );
    }
  }

  let url: string | null = null;
  let source = "none";
  let throttled = false;

  if (did) {
    const r = await fetchDiscogsByDid(did);
    url = r.url;
    if (r.throttled) throttled = true;
    if (url) source = "discogs-did";
  }

  if (!url) {
    const r = await searchDiscogs(artista, titulo);
    url = r.url;
    if (r.throttled) throttled = true;
    if (url) source = "discogs-search";
  }

  if (!url) {
    const cleanArtist = clean(artista);
    const cleanTitle = clean(titulo);
    const queries: string[] = [];
    if (cleanArtist && cleanTitle) {
      queries.push(`${cleanArtist} ${cleanTitle}`);
      queries.push(cleanTitle);
    } else if (cleanTitle) {
      queries.push(cleanTitle);
    } else if (cleanArtist) {
      queries.push(cleanArtist);
    }
    for (const q of queries) {
      url = await searchItunes(q);
      if (url) {
        source = "itunes";
        break;
      }
    }
  }

  if (url) {
    await setHit(key, url, source);
  } else if (!throttled) {
    setMiss(key);
  }

  return Response.json(
    { url, source, cached: false, throttled },
    {
      headers: {
        "Cache-Control": url
          ? "public, max-age=2592000, immutable"
          : "public, max-age=300",
      },
    }
  );
}
