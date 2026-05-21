import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PendingInteraction } from "@/components/PendingInteraction";
import { SiteNav } from "@/components/SiteNav";
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

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <PendingInteraction />
        </Suspense>
        <SiteNav />
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
