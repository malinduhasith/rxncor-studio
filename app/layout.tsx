import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
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
    icon: "/sig.png",
    shortcut: "/sig.png",
    apple: "/sig.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav className="shell nav" aria-label="Main navigation">
            <Link className="brand" href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo" src="/sig.png" alt="" aria-hidden="true" />
              <span className="sr-only">{siteConfig.name}</span>
            </Link>
            <div className="nav-links">
              <Link href={siteConfig.routes.about}>About</Link>
              <Link href={siteConfig.routes.portfolio}>Portfolio</Link>
              <Link href={siteConfig.routes.albums}>Albums</Link>
              <Link href="/#book">Book</Link>
              <Link className="button secondary" href={siteConfig.routes.login}>
                Login
              </Link>
            </div>
          </nav>
        </header>
        {children}
        <footer className="footer">
          <div className="shell footer-inner">
            <p>
              {siteConfig.name} · Portfolio, private galleries, and client delivery.
            </p>
            <div className="footer-links">
              <Link href={siteConfig.routes.about}>About</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
