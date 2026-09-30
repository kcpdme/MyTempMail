import { getSettings, publicConfig } from "@/lib/settings";
import { readSession } from "@/lib/session";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSettings({ fresh: true });
    const config = publicConfig(settings);
    const session = await readSession();
    if (session.role !== "member") config.domains = config.guestDomains;
    return jsonOk(config);
  } catch (error) {
    return jsonError(error);
  }
}
