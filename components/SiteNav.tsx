"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { siteConfig } from "@/config/site";

const navItems = [
  { href: siteConfig.routes.about, label: "About" },
  { href: siteConfig.routes.portfolio, label: "Portfolio" },
  { href: siteConfig.routes.albums, label: "Albums", alsoActive: ["/client"] },
  { href: siteConfig.routes.book, label: "Book" }
];

function isActive(pathname: string, href: string, alsoActive: string[] = []) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || alsoActive.some((path) => pathname.startsWith(path));
}

export function SiteNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    setMenuOpen(false);

    if (!href.startsWith("/#") || pathname !== "/") {
      return;
    }

    const target = document.getElementById(href.slice(2));

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.pushState(null, "", href);
  }

  return (
    <header className="site-header" data-menu-open={menuOpen ? "true" : "false"}>
      <nav className="shell nav" aria-label="Main navigation">
        <Link className="brand" data-pending-label="home" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/sig.png" alt="" aria-hidden="true" />
          <span className="sr-only">{siteConfig.name}</span>
        </Link>
        <button
          aria-controls="site-navigation-links"
          aria-expanded={menuOpen}
          className="mobile-menu-button"
          onClick={() => setMenuOpen((current) => !current)}
          type="button"
        >
          <span>{menuOpen ? "Close" : "Menu"}</span>
          <i aria-hidden="true" />
        </button>
        <div
          className="nav-links"
          data-open={menuOpen ? "true" : "false"}
          id="site-navigation-links"
        >
          {navItems.map((item) => {
            const active = isActive(pathname, item.href, item.alsoActive);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                data-pending-label={item.label}
                href={item.href}
                key={item.href}
                onClick={(event) => handleNavClick(event, item.href)}
              >
                {item.label}
              </Link>
            );
          })}
          <ThemeToggle />
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
