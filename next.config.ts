import type { NextConfig } from "next";

// STATIC_EXPORT=1 builds a plain static site for GitHub Pages (no server;
// Claude is then called from the browser, see src/lib/api.ts).
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = staticExport
  ? {
      output: "export",
      basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
