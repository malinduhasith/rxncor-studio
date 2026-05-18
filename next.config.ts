import type { NextConfig } from "next";
import { siteConfig } from "./config/site";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com"
      },
      {
        protocol: "https",
        hostname: new URL(siteConfig.r2PublicBaseUrl).hostname
      }
    ]
  }
};

export default nextConfig;
