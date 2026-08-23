import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessPassword, accessRequired, verifyAccessToken } from "@/lib/access";

const PUBLIC_PATHS = new Set(["/login", "/api/access", "/api/webhooks/resend"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export async function proxy(request: NextRequest) {
  if (!accessRequired() || isPublic(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const ok = await verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value, accessPassword());
  if (ok) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
