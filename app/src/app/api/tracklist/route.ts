import { NextRequest } from "next/server";

type DiscogsTrack = {
  position: string;
  type_: string;
  title: string;
  duration: string;
  sub_tracks?: DiscogsTrack[];
};

type DiscogsRelease = {
  tracklist?: DiscogsTrack[];
};

export type Track = {
  position: string;
  title: string;
  duration: string;
  isHeading: boolean;
};

const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
const UA = "vinilos-catalog/1.0";

function flattenTracks(tracks: DiscogsTrack[]): Track[] {
  const out: Track[] = [];
  for (const t of tracks) {
    if (t.type_ === "heading") {
      out.push({ position: "", title: t.title, duration: "", isHeading: true });
    } else if (t.sub_tracks?.length) {
      out.push({ position: t.position, title: t.title, duration: t.duration, isHeading: false });
      for (const st of t.sub_tracks) {
        out.push({ position: st.position, title: st.title, duration: st.duration, isHeading: false });
      }
    } else {
      out.push({ position: t.position, title: t.title, duration: t.duration, isHeading: false });
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const did = req.nextUrl.searchParams.get("did")?.trim();
  if (!did) return Response.json({ error: "missing did" }, { status: 400 });
  if (!DISCOGS_TOKEN) return Response.json({ error: "no token" }, { status: 503 });

  const res = await fetch(`https://api.discogs.com/releases/${encodeURIComponent(did)}`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
    headers: {
      "User-Agent": UA,
      Authorization: `Discogs token=${DISCOGS_TOKEN}`,
    },
  });

  if (res.status === 429) return Response.json({ error: "throttled" }, { status: 429 });
  if (!res.ok) return Response.json({ error: "not found" }, { status: res.status });

  const data = (await res.json()) as DiscogsRelease;
  const tracks = flattenTracks(data.tracklist ?? []);

  return Response.json(
    { tracks },
    { headers: { "Cache-Control": "public, max-age=2592000, immutable" } }
  );
}
