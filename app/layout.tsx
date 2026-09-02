import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CookieConsent, CookieSettingsButton } from "@/components/CookieConsent";
import { MotionController } from "@/components/home/MotionController";
import { CompositionMark } from "@/components/home/CompositionMark";
import { MobileViewportGuard } from "@/components/MobileViewportGuard";
import { PendingInteraction } from "@/components/PendingInteraction";
import { SiteNav } from "@/components/SiteNav";
import { siteConfig } from "@/config/site";
import { getSiteContactSettings } from "@/lib/site-settings";
import "./globals.css";
import "./experience.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} | Melbourne Photographer`,
    template: `%s | ${siteConfig.name}`
  },
  description: siteConfig.description,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: `${siteConfig.name} | Melbourne Photographer`,
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
    title: `${siteConfig.name} | Melbourne Photographer`,
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

const themeScript = `(() => {
  try {
    const key = "rxncor_theme_v1";
    const saved = localStorage.getItem(key);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved === "dark" || saved === "light" ? saved : prefersDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.setAttribute("data-theme", "light");
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
      <body className="rx-body">
        <MobileViewportGuard />
        <MotionController />
        <Suspense fallback={null}>
          <PendingInteraction />
        </Suspense>
        <CookieConsent />
        <SiteNav />
        {children}
        <footer className="rx-footer" id="contact">
          <div className="rx-footer-stairs" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i /><i />
          </div>
          <div aria-hidden="true" className="rx-footer-vector-field">
            <CompositionMark className="rx-footer-vector rx-footer-vector-focus" variant="focus" />
            <CompositionMark className="rx-footer-vector rx-footer-vector-wave" variant="waveform" />
            <CompositionMark className="rx-footer-vector rx-footer-vector-spiral" variant="spiral" />
          </div>
          <div className="rx-footer-marquee" aria-hidden="true">
            <div>BOOK / CREATE / DELIVER / BOOK / CREATE / DELIVER / BOOK / CREATE / DELIVER /</div>
          </div>
          <div className="rx-footer-main">
            <div className="rx-section-kicker">
              <span>Make something worth remembering</span>
              <span>{siteContactSettings.location}</span>
            </div>
            <h2>
              <Link data-cursor="Book" href={siteConfig.routes.book}>
                <span>LET&apos;S</span><span>CREATE.</span>
              </Link>
            </h2>
            <div className="rx-footer-grid">
              <div>
                <span className="rx-footer-label">Start here</span>
                <a className="rx-footer-email" href={`mailto:${siteContactSettings.contactEmail}`}>
                  {siteContactSettings.contactEmail}
                </a>
                {siteContactSettings.contactPhone ? (
                  <a href={`tel:${siteContactSettings.contactPhone}`}>
                    {siteContactSettings.contactPhone}
                  </a>
                ) : null}
              </div>
              <div>
                <span className="rx-footer-label">Navigate</span>
                <Link href={siteConfig.routes.portfolio}>Portfolio</Link>
                <Link href={siteConfig.routes.albums}>Albums</Link>
                <Link href={siteConfig.routes.book}>Book a shoot</Link>
                <Link href={siteConfig.routes.login}>Client access</Link>
              </div>
              <div>
                <span className="rx-footer-label">Follow</span>
                {siteContactSettings.socialLinks.slice(0, 5).map((social) => (
                  <a
                    href={social.href}
                    key={`${social.label}-${social.href}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {social.label} <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </div>
            <div className="rx-footer-bottom">
              <span>© {new Date().getFullYear()} RXNCOR STUDIO</span>
              <span>MELBOURNE / AUSTRALIA</span>
              <div>
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
                <CookieSettingsButton />
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
