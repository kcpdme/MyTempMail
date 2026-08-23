import { NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  accessRequired,
  signAccessToken,
  accessPassword,
  verifyAccessPassword,
} from "@/lib/access";
import { HttpError } from "@/lib/domains";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonOk({ required: accessRequired() });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { action?: string; password?: string };
    if (body.action === "logout") {
      const res = jsonOk({ ok: true });
      res.cookies.delete(ACCESS_COOKIE);
      return res;
    }
    if (!accessRequired()) {
      return jsonOk({ ok: true, required: false });
    }
    if (!verifyAccessPassword(body.password ?? "")) {
      throw new HttpError("Invalid password", 401);
    }
    const token = await signAccessToken(accessPassword());
    const res = jsonOk({ ok: true });
    res.cookies.set(ACCESS_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ACCESS_MAX_AGE,
    });
    return res;
  } catch (error) {
    return jsonError(error);
  }
}
