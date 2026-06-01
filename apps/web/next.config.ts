import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @1manbiz/shared ships raw TS (no build step); Next must transpile it.
  transpilePackages: ["@1manbiz/shared"],
  poweredByHeader: false,
  // Hide the Next.js dev indicator (the floating "N" badge in the corner).
  devIndicators: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
