"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { siteConfig } from "@/config/site";

const navItems = [
  { href: siteConfig.routes.about, label: "About", index: "01" },
  { href: "/#frames", label: "Frames", index: "02" },
  { href: "/#work", label: "Work", index: "03" },
  { href: siteConfig.routes.albums, label: "Albums", index: "04" }
];

let navScrollFrame = 0;

function scrollToSection(top: number) {
  window.cancelAnimationFrame(navScrollFrame);

  const start = window.scrollY;
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const destination = Math.min(max, Math.max(0, top));

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, destination);
    return;
  }

  const startedAt = performance.now();
  const duration = Math.min(1400, Math.max(760, Math.abs(destination - start) * 0.22));

  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 4);
    window.scrollTo(0, start + (destination - start) * eased);

    if (progress < 1) {
      navScrollFrame = window.requestAnimationFrame(step);
    }
  };

  navScrollFrame = window.requestAnimationFrame(step);
}

function isActive(pathname: string, href: string) {
  if (href.includes("#")) {
    return false;
  }

  return pathname === href || (href === "/albums" && pathname.startsWith("/client"));
}

export function SiteNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("rx-menu-locked", menuOpen);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("rx-menu-locked");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

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
    scrollToSection(target.getBoundingClientRect().top + window.scrollY);
    window.history.pushState(null, "", href);
  }

  return (
    <header
      className="site-header rx-site-header"
      data-home={pathname === "/" ? "true" : "false"}
      data-menu-open={menuOpen ? "true" : "false"}
    >
      <nav className="rx-nav" aria-label="Main navigation">
        <Link className="rx-brand" data-pending-label="home" href="/">
          <span className="rx-signature-mark" aria-hidden="true">
            <Image alt="" height={41} priority src="/sig.png" width={136} />
          </span>
          <span className="rx-brand-location">Photo studio / Melbourne</span>
        </Link>

        <button
          aria-controls="site-navigation-links"
          aria-expanded={menuOpen}
          className="rx-menu-button"
          onClick={() => setMenuOpen((current) => !current)}
          type="button"
        >
          <span>{menuOpen ? "Close" : "Menu"}</span>
          <i aria-hidden="true" />
        </button>

        <div
          className="rx-nav-panel"
          data-open={menuOpen ? "true" : "false"}
          id="site-navigation-links"
        >
          <div className="rx-nav-links">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              const renderedHref =
                pathname === "/" && item.href.startsWith("/#")
                  ? item.href.slice(1)
                  : item.href;

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  data-pending-label={item.label}
                  href={renderedHref}
                  key={item.href}
                  onClick={(event) => handleNavClick(event, item.href)}
                >
                  <small>{item.index}</small>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="rx-nav-actions">
            <ThemeToggle />
            <Link
              className="rx-client-link"
              data-pending-label="client access"
              href={siteConfig.routes.login}
            >
              Client access <span aria-hidden="true">↗</span>
            </Link>
            <Link
              className="rx-book-link"
              data-pending-label="booking page"
              href={siteConfig.routes.book}
            >
              Let&apos;s shoot <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
