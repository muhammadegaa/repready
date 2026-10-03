import type { NextConfig } from "next";

const config: NextConfig = {
  // A coach can upload a spreadsheet to be read; the default limit is 1 MB. Vercel itself allows 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default config;
