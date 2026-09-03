import { jsonOk } from "@/lib/http";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  return jsonOk(session);
}
