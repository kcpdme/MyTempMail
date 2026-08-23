import { getSettings, publicConfig } from "@/lib/settings";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSettings();
    return jsonOk(publicConfig(settings));
  } catch (error) {
    return jsonError(error);
  }
}
