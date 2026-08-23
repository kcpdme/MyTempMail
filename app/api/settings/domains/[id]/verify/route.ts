import { requireSettingsAuth } from "@/lib/auth";
import { HttpError } from "@/lib/domains";
import { jsonError, jsonOk } from "@/lib/http";
import { refreshResendDomain, verifyResendDomain } from "@/lib/resend";
import { getSettings, saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireSettingsAuth();
    const { id } = await context.params;
    const settings = await getSettings();
    if (!settings.resendApiKey) throw new HttpError("Resend API key is not set", 400);
    await verifyResendDomain(settings.resendApiKey, id);
    const domain = await refreshResendDomain(settings.resendApiKey, id);
    settings.domains = settings.domains.map((d) => (d.resendId === id ? { ...d, ...domain } : d));
    await saveSettings(settings);
    return jsonOk({ domain });
  } catch (error) {
    return jsonError(error);
  }
}
