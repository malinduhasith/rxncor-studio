"use client";

import { useEffect } from "react";

export function MobileViewportGuard() {
  useEffect(() => {
    function lockHorizontalScroll() {
      if (window.innerWidth > 900 || window.scrollX === 0) {
        return;
      }

      window.scrollTo(0, window.scrollY);
    }

    window.addEventListener("scroll", lockHorizontalScroll, { passive: true });
    window.addEventListener("resize", lockHorizontalScroll);
    window.visualViewport?.addEventListener("resize", lockHorizontalScroll);

    lockHorizontalScroll();

    return () => {
      window.removeEventListener("scroll", lockHorizontalScroll);
      window.removeEventListener("resize", lockHorizontalScroll);
      window.visualViewport?.removeEventListener("resize", lockHorizontalScroll);
    };
  }, []);

  return null;
}
