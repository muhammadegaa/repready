import type { NextConfig } from "next";

// Headers every response carries. The player link is a secret in the address, so no page may send it onward as a referrer.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const config: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // A coach can upload a spreadsheet to be read; the default limit is 1 MB. Vercel itself allows 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default config;
