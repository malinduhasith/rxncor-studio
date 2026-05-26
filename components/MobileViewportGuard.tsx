"use client";

import { useEffect } from "react";

export function MobileViewportGuard() {
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;

    function lockHorizontalScroll() {
      if (window.innerWidth > 900 || window.scrollX === 0) {
        return;
      }

      window.scrollTo(0, window.scrollY);
    }

    function allowsHorizontalScroll(target: EventTarget | null) {
      let element = target instanceof Element ? target : null;

      while (element && element !== document.body) {
        const style = window.getComputedStyle(element);
        const canScroll =
          (style.overflowX === "auto" || style.overflowX === "scroll") &&
          element.scrollWidth > element.clientWidth + 2;

        if (canScroll) {
          return true;
        }

        element = element.parentElement;
      }

      return false;
    }

    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];

      if (!touch) {
        return;
      }

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }

    function handleTouchMove(event: TouchEvent) {
      if (window.innerWidth > 900 || allowsHorizontalScroll(event.target)) {
        return;
      }

      const touch = event.touches[0];

      if (!touch) {
        return;
      }

      const deltaX = Math.abs(touch.clientX - touchStartX);
      const deltaY = Math.abs(touch.clientY - touchStartY);

      if (deltaX > 10 && deltaX > deltaY * 1.15) {
        event.preventDefault();
        event.stopPropagation();
        lockHorizontalScroll();
      }
    }

    window.addEventListener("scroll", lockHorizontalScroll, { passive: true });
    window.addEventListener("resize", lockHorizontalScroll);
    document.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: true
    });
    document.addEventListener("touchmove", handleTouchMove, {
      capture: true,
      passive: false
    });
    window.visualViewport?.addEventListener("resize", lockHorizontalScroll);

    lockHorizontalScroll();

    return () => {
      window.removeEventListener("scroll", lockHorizontalScroll);
      window.removeEventListener("resize", lockHorizontalScroll);
      document.removeEventListener("touchstart", handleTouchStart, { capture: true });
      document.removeEventListener("touchmove", handleTouchMove, { capture: true });
      window.visualViewport?.removeEventListener("resize", lockHorizontalScroll);
    };
  }, []);

  return null;
}
