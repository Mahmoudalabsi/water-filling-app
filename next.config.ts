import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
