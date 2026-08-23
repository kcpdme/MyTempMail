import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessPassword, accessRequired, verifyAccessToken } from "@/lib/access";

function stripSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function isPublic(pathname: string): boolean {
  const path = stripSlash(pathname);
  if (path === "/login" || path === "/api/access") return true;
  if (path === "/api/webhooks/resend") return true;
  if (pathname.startsWith("/_next")) return true;
  if (path === "/favicon.ico") return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const path = stripSlash(request.nextUrl.pathname);
  if (path === "/api/webhooks/resend") {
    return NextResponse.next();
  }

  if (!accessRequired() || isPublic(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const ok = await verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value, accessPassword());
  if (ok) return NextResponse.next();

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
