"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";

const navItems = [
  { href: siteConfig.routes.about, label: "About" },
  { href: siteConfig.routes.portfolio, label: "Portfolio" },
  { href: siteConfig.routes.albums, label: "Albums", alsoActive: ["/client"] },
  { href: "/#book", label: "Book" }
];

function isActive(pathname: string, href: string, alsoActive: string[] = []) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || alsoActive.some((path) => pathname.startsWith(path));
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <nav className="shell nav" aria-label="Main navigation">
        <Link className="brand" data-pending-label="home" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/sig.png" alt="" aria-hidden="true" />
          <span className="sr-only">{siteConfig.name}</span>
        </Link>
        <div className="nav-links">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href, item.alsoActive);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                data-pending-label={item.label}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            aria-current={pathname === siteConfig.routes.login ? "page" : undefined}
            className="button secondary nav-login"
            data-pending-label="client login"
            href={siteConfig.routes.login}
          >
            Login
          </Link>
        </div>
      </nav>
    </header>
  );
}
