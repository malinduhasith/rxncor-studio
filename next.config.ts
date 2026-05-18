import type { NextConfig } from "next";

function getHostname(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return fallback;
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com"
      },
      {
        protocol: "https",
        hostname: getHostname(
          process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL,
          "cdn.rxncor.studio"
        )
      }
    ]
  }
};

export default nextConfig;
