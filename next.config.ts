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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          {
            key: "Content-Security-Policy",
            value: "upgrade-insecure-requests"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          }
        ]
      }
    ];
  },
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
