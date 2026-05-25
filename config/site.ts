function publicEnv(name: string, fallback: string) {
  return process.env[name] || fallback;
}

function optionalPublicEnv(name: string) {
  return process.env[name] || "";
}

const contactEmail = publicEnv("NEXT_PUBLIC_CONTACT_EMAIL", "hello@rxncor.studio");
const instagramHandle = publicEnv(
  "NEXT_PUBLIC_INSTAGRAM_HANDLE",
  "@rxncor.studio"
);
const instagramUrl = publicEnv(
  "NEXT_PUBLIC_INSTAGRAM_URL",
  "https://instagram.com/rxncor.studio"
);
const facebookHandle = optionalPublicEnv("NEXT_PUBLIC_FACEBOOK_HANDLE");
const facebookUrl = optionalPublicEnv("NEXT_PUBLIC_FACEBOOK_URL");
const contactPhone = optionalPublicEnv("NEXT_PUBLIC_CONTACT_PHONE");
const location = publicEnv("NEXT_PUBLIC_LOCATION", "Melbourne, Australia");
const socialLinks = [
  {
    label: "Instagram",
    handle: instagramHandle,
    href: instagramUrl,
        detail: "Recent work, behind-the-scenes frames, and updates."
      },
  facebookUrl
    ? {
        label: "Facebook",
        handle: facebookHandle || "rxncor.studio",
        href: facebookUrl,
        detail: "Public updates, albums, and booking information."
      }
    : null,
  optionalPublicEnv("NEXT_PUBLIC_THREADS_URL")
    ? {
        label: "Threads",
        handle: optionalPublicEnv("NEXT_PUBLIC_THREADS_HANDLE") || "rxncor.studio",
        href: optionalPublicEnv("NEXT_PUBLIC_THREADS_URL"),
        detail: "Short updates and work-in-progress notes."
      }
    : null,
  optionalPublicEnv("NEXT_PUBLIC_LINKEDIN_URL")
    ? {
        label: "LinkedIn",
        handle: optionalPublicEnv("NEXT_PUBLIC_LINKEDIN_HANDLE") || "Malindu Herath",
        href: optionalPublicEnv("NEXT_PUBLIC_LINKEDIN_URL"),
        detail: "Creative, software, and systems background."
      }
    : null,
  optionalPublicEnv("NEXT_PUBLIC_YOUTUBE_URL")
    ? {
        label: "YouTube",
        handle: optionalPublicEnv("NEXT_PUBLIC_YOUTUBE_HANDLE") || "rxncor.studio",
        href: optionalPublicEnv("NEXT_PUBLIC_YOUTUBE_URL"),
        detail: "Video work and longer-form visual stories."
      }
    : null
].filter((link): link is NonNullable<typeof link> => Boolean(link));

export const siteConfig = {
  name: "rxncor.studio",
  domain: "rxncor.studio",
  url: publicEnv("NEXT_PUBLIC_SITE_URL", "https://rxncor.studio"),
  description:
    "Photography portfolio, booking enquiries, and private client gallery delivery.",
  contactEmail,
  contactPhone,
  location,
  instagramHandle,
  instagramUrl,
  facebookHandle,
  facebookUrl,
  socialLinks,
  r2PublicBaseUrl: publicEnv(
    "NEXT_PUBLIC_R2_PUBLIC_BASE_URL",
    "https://cdn.rxncor.studio"
  ),
  r2BucketName: "rxncor-studio-photos",
  routes: {
    home: "/",
    about: "/about",
    portfolio: "/portfolio",
    albums: "/albums",
    admin: "/admin",
    adminLogin: "/rxncor-admin",
    login: "/login",
    clientPortal: "/client-portal",
    clientGallery: "/client"
  }
} as const;
