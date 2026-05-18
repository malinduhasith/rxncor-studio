function publicEnv(name: string, fallback: string) {
  return process.env[name] || fallback;
}

export const siteConfig = {
  name: "rxncor.studio",
  domain: "rxncor.studio",
  url: publicEnv("NEXT_PUBLIC_SITE_URL", "https://rxncor.studio"),
  description: "Photography portfolio and private client galleries.",
  contactEmail: publicEnv("NEXT_PUBLIC_CONTACT_EMAIL", "hello@rxncor.studio"),
  instagramHandle: publicEnv("NEXT_PUBLIC_INSTAGRAM_HANDLE", "@rxncor.studio"),
  instagramUrl: publicEnv(
    "NEXT_PUBLIC_INSTAGRAM_URL",
    "https://instagram.com/rxncor.studio"
  ),
  r2PublicBaseUrl: publicEnv(
    "NEXT_PUBLIC_R2_PUBLIC_BASE_URL",
    "https://cdn.rxncor.studio"
  ),
  r2BucketName: "rxncor-studio-photos",
  routes: {
    home: "/",
    portfolio: "/portfolio",
    albums: "/albums",
    admin: "/admin",
    adminLogin: "/rxncor-admin",
    login: "/login",
    clientPortal: "/client-portal",
    clientGallery: "/client"
  }
} as const;
