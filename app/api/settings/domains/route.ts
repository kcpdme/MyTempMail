import { NextRequest } from "next/server";
import { requireSettingsAuth } from "@/lib/auth";
import { HttpError } from "@/lib/domains";
import { isMockMode } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { addResendDomain, importResendDomains, refreshResendDomain } from "@/lib/resend";
import { getSettings, saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireSettingsAuth();
    const body = (await request.json()) as { name?: string; sync?: boolean };
    const settings = await getSettings();

    if (body.sync) {
      if (isMockMode() || !settings.resendApiKey) {
        throw new HttpError("Resend API key is not set", 400);
      }
      const imported = await importResendDomains(
        settings.resendApiKey,
        settings.domains.map((d) => d.name),
      );
      if (imported.length > 0) {
        settings.domains = [...settings.domains, ...imported];
        await saveSettings(settings);
      }
      return jsonOk({ imported, count: imported.length });
    }

    const name = (body.name ?? "").trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(name)) {
      throw new HttpError("Invalid domain");
    }
    if (settings.domains.some((d) => d.name === name)) {
      throw new HttpError("Domain already added");
    }

    if (isMockMode() || !settings.resendApiKey) {
      const domain = { name, status: "mock" as const };
      settings.domains = [...settings.domains, domain];
      await saveSettings(settings);
      return jsonOk({ domain, imported: false });
    }

    const { domain, imported } = await addResendDomain(settings.resendApiKey, name);
    settings.domains = [...settings.domains, domain];
    await saveSettings(settings);
    return jsonOk({ domain, imported });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireSettingsAuth();
    const name = request.nextUrl.searchParams.get("name")?.trim().toLowerCase();
    if (!name) throw new HttpError("Domain is required");
    const settings = await getSettings();
    settings.domains = settings.domains.filter((d) => d.name !== name);
    await saveSettings(settings);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireSettingsAuth();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) throw new HttpError("Domain id is required");
    const settings = await getSettings();
    if (!settings.resendApiKey) throw new HttpError("Resend API key is not set", 400);
    const domain = await refreshResendDomain(settings.resendApiKey, id);
    settings.domains = settings.domains.map((d) => (d.resendId === id ? { ...d, ...domain } : d));
    await saveSettings(settings);
    return jsonOk({ domain });
  } catch (error) {
    return jsonError(error);
  }
}
