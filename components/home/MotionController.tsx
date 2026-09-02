"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function MotionController() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.classList.add("rx-motion-ready");

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-visible", "true");
            revealObserver.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 }
    );

    const revealElements = document.querySelectorAll("[data-reveal]");
    revealElements.forEach((element) => revealObserver.observe(element));

    let frame = 0;
    const updateScrollState = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        document.documentElement.toggleAttribute("data-scrolled", window.scrollY > 24);
      });
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      revealObserver.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateScrollState);
      document.documentElement.classList.remove("rx-motion-ready");
      document.documentElement.removeAttribute("data-scrolled");
    };
  }, [pathname]);

  return null;
}
