import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CookieConsent, CookieSettingsButton } from "@/components/CookieConsent";
import { PendingInteraction } from "@/components/PendingInteraction";
import { SiteNav } from "@/components/SiteNav";
import { siteConfig } from "@/config/site";
import { getSiteContactSettings } from "@/lib/site-settings";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} | Photography and Client Galleries`,
    template: `%s | ${siteConfig.name}`
  },
  description: siteConfig.description,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: `${siteConfig.name} | Photography and Client Galleries`,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: siteConfig.name
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} | Photography and Client Galleries`,
    description: siteConfig.description,
    images: ["/opengraph-image"]
  },
  icons: {
    icon: [
      {
        url: "/favicon.png",
        sizes: "512x512",
        type: "image/png"
      }
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png"
  }
};

const themeScript = `(() => {
  try {
    const key = "rxncor_theme_v1";
    const saved = localStorage.getItem(key);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved === "dark" || saved === "light" ? saved : prefersDark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();`;

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteContactSettings = await getSiteContactSettings();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeScript }}
          id="rxncor-theme"
        />
      </head>
      <body>
        <Suspense fallback={null}>
          <PendingInteraction />
        </Suspense>
        <CookieConsent />
        <SiteNav />
        {children}
        <footer className="footer">
          <div className="shell footer-inner">
            <p>
              {siteConfig.name} · Portfolio, private galleries, and client delivery.
            </p>
            <div className="footer-links">
              <Link href={siteConfig.routes.about}>About</Link>
              <Link href="/#contact">Contact</Link>
              {siteContactSettings.socialLinks.slice(0, 4).map((social) => (
                <a
                  href={social.href}
                  key={`${social.label}-${social.href}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {social.label}
                </a>
              ))}
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <CookieSettingsButton />
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
