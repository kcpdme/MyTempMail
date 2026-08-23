import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webhook POSTs must not 308 on a trailing slash — Resend will not follow that.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
