import { NextRequest } from "next/server";
import { assertDisposableAddress, domainAllowlist } from "@/lib/domains";
import { jsonError, jsonOk } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email") ?? "";
    const settings = await getSettings();
    const parsed = assertDisposableAddress(email, domainAllowlist(settings.domains));
    const messages = await getStore().listInbox(parsed.email);
    return jsonOk({ email: parsed.email, messages });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email") ?? "";
    const id = request.nextUrl.searchParams.get("id");
    const settings = await getSettings();
    const parsed = assertDisposableAddress(email, domainAllowlist(settings.domains));
    if (id) {
      await getStore().deleteMessage(parsed.email, id);
    } else {
      await getStore().clearInbox(parsed.email);
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
