function stripSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function isAlwaysPublicPath(pathname: string): boolean {
  const path = stripSlash(pathname);
  if (path === "/login" || path === "/api/access" || path === "/api/guest") return true;
  if (path === "/api/config" || path === "/api/session") return true;
  if (path === "/api/webhooks/resend") return true;
  if (pathname.startsWith("/_next")) return true;
  if (path === "/favicon.ico" || path === "/manifest.webmanifest") return true;
  if (path.startsWith("/icons/")) return true;
  return false;
}

/** Paths a valid guest cookie may call. Write/send/settings stay blocked. */
export function isGuestAllowedRequest(method: string, pathname: string): boolean {
  const path = stripSlash(pathname);
  const verb = method.toUpperCase();
  if (verb === "GET" || verb === "HEAD") {
    if (path === "/") return true;
    if (path === "/api/config" || path === "/api/session") return true;
    if (path === "/api/inbox") return true;
    if (path.startsWith("/api/inbox/")) return true;
    return false;
  }
  return false;
}
