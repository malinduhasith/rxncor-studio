import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: siteConfig.name,
  description: siteConfig.description
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
              {siteConfig.name}
            </Link>
            <div className="nav-links">
              <Link href={siteConfig.routes.portfolio}>Portfolio</Link>
              <Link href={siteConfig.routes.albums}>Albums</Link>
              <Link href={siteConfig.routes.admin}>Admin</Link>
              <Link className="button secondary" href={siteConfig.routes.login}>
                Login
              </Link>
            </div>
          </nav>
        </header>
        {children}
        <footer className="footer">
          <div className="shell">
            <p>
              {siteConfig.name} · Portfolio, private galleries, and client delivery.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
