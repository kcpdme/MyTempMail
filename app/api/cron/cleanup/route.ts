import { timingSafeEqual } from "node:crypto";
import { cleanupExpired, getTurso } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Cleanup is not configured" }, { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = getTurso();
    let deleted = 0;
    let more = false;
    const deadline = Date.now() + 40_000;
    for (let batch = 0; batch < 20; batch++) {
      const count = await cleanupExpired(db);
      deleted += count;
      more = count >= 500;
      if (!more || Date.now() >= deadline) break;
    }
    return Response.json({ deleted, more });
  } catch {
    return Response.json({ error: "Database cleanup failed" }, { status: 503 });
  }
}
