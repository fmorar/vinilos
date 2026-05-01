import { revalidateTag } from "next/cache";

export async function POST() {
  revalidateTag("vinilos");
  return Response.json({
    ok: true,
    revalidated: "vinilos",
    at: new Date().toISOString(),
  });
}

export async function GET() {
  revalidateTag("vinilos");
  return Response.json({
    ok: true,
    revalidated: "vinilos",
    at: new Date().toISOString(),
  });
}
