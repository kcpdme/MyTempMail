import { NextRequest } from "next/server";
import { assertDisposableAddress, domainAllowlist } from "@/lib/domains";
import { jsonError, jsonOk } from "@/lib/http";
import { requireCanRead } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const email = request.nextUrl.searchParams.get("email") ?? "";
    const settings = await getSettings();
    const parsed = assertDisposableAddress(email, domainAllowlist(settings.domains));
    await requireCanRead(parsed.email);
    const message = await getStore().getMessage(parsed.email, id);
    if (!message) {
      return jsonError(Object.assign(new Error("Message not found"), { status: 404 }));
    }
    return jsonOk({ message });
  } catch (error) {
    return jsonError(error);
  }
}
