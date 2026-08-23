import { NextRequest } from "next/server";
import { assertDisposableAddress, domainAllowlist, HttpError, isExternalEmail } from "@/lib/domains";
import { jsonError, jsonOk } from "@/lib/http";
import { clientIp, limitSend } from "@/lib/ratelimit";
import { sendMail } from "@/lib/resend";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const MAX_BODY = 100 * 1024;

export async function POST(request: NextRequest) {
  try {
    const limited = await limitSend(clientIp(request));
    if (!limited.ok) {
      throw new HttpError("Too many sends. Try again later.", 429);
    }

    const body = (await request.json()) as {
      from?: string;
      to?: string | string[];
      subject?: string;
      text?: string;
      html?: string;
      headers?: Record<string, string>;
    };

    const settings = await getSettings();
    const from = assertDisposableAddress(body.from ?? "", domainAllowlist(settings.domains));
    const recipients = (Array.isArray(body.to) ? body.to : String(body.to ?? "").split(/[,;]/))
      .map((item) => item.trim())
      .filter(Boolean);
    if (!recipients.length || recipients.some((item) => !isExternalEmail(item))) {
      throw new HttpError("Invalid recipient");
    }
    const subject = (body.subject ?? "").trim();
    if (!subject || subject.length > 200) {
      throw new HttpError("Subject is required");
    }
    const text = body.text ?? "";
    const html = body.html ?? "";
    if (!text.trim() && !html.trim()) {
      throw new HttpError("Message body is required");
    }
    if (text.length + html.length > MAX_BODY) {
      throw new HttpError("Message is too large");
    }
    if (!settings.resendApiKey && process.env.MOCK_MODE !== "1") {
      // still allow mock via isMockMode in sendMail
    }

    const result = await sendMail(settings.resendApiKey, {
      from: from.email,
      to: recipients.length === 1 ? recipients[0] : recipients,
      subject,
      text: text || html.replace(/<[^>]+>/g, " "),
      html: html || undefined,
      replyTo: from.email,
      headers: body.headers,
    });
    return jsonOk({ id: result.id });
  } catch (error) {
    return jsonError(error);
  }
}
