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
    const sharedSecurityHeaders = [
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload"
      },
      {
        key: "Content-Security-Policy",
        value:
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin"
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff"
      },
      {
        key: "X-Frame-Options",
        value: "DENY"
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()"
      }
    ];
    const privateRouteHeaders = [
      {
        key: "X-Robots-Tag",
        value: "noindex, nofollow, noarchive"
      },
      {
        key: "Cache-Control",
        value: "no-store"
      }
    ];

    return [
      {
        source: "/:path*",
        headers: sharedSecurityHeaders
      },
      {
        source: "/admin/:path*",
        headers: privateRouteHeaders
      },
      {
        source: "/rxncor-admin",
        headers: privateRouteHeaders
      },
      {
        source: "/rxncor-admin/:path*",
        headers: privateRouteHeaders
      },
      {
        source: "/login",
        headers: privateRouteHeaders
      },
      {
        source: "/client/:path*",
        headers: privateRouteHeaders
      },
      {
        source: "/client-portal/:path*",
        headers: privateRouteHeaders
      },
      {
        source: "/api/:path*",
        headers: privateRouteHeaders
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
