import { getStats } from "../../../../lib/coverCache";

export async function GET() {
  const s = await getStats();
  return Response.json(s);
}
