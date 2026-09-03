import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessPassword, accessRequired, verifyAccessToken } from "@/lib/access";
import { isAlwaysPublicPath, isGuestAllowedRequest } from "@/lib/guest-paths";
import { GUEST_COOKIE, verifyGuestToken } from "@/lib/guest-session";

function stripSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export async function proxy(request: NextRequest) {
  const path = stripSlash(request.nextUrl.pathname);
  if (path === "/api/webhooks/resend") {
    return NextResponse.next();
  }

  if (!accessRequired() || isAlwaysPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const secret = accessPassword();
  const memberOk = await verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value, secret);
  if (memberOk) return NextResponse.next();

  const guest = await verifyGuestToken(request.cookies.get(GUEST_COOKIE)?.value, secret);
  if (guest && isGuestAllowedRequest(request.method, request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  if (guest) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Guest sessions are receive-only" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

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
