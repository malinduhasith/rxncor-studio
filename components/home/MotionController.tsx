"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

function isNativeScrollTarget(target: EventTarget | null) {
  return target instanceof Element
    ? Boolean(
        target.closest(
          "input, textarea, select, [contenteditable='true'], [data-native-scroll]"
        )
      )
    : false;
}

export function MotionController() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const cursor = document.querySelector<HTMLElement>(".rr-cursor-orb");
    const cursorLabel = cursor?.querySelector<HTMLElement>("span");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    const isHome = pathname === "/";
    const smoothEnabled = isHome && finePointer.matches && !reducedMotion.matches;

    root.classList.add("rr-motion-ready");
    document.body.classList.toggle("rr-smooth-enabled", smoothEnabled);

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-visible", "true");
          revealObserver.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -9%", threshold: 0.08 }
    );

    document
      .querySelectorAll("[data-reveal]")
      .forEach((element) => revealObserver.observe(element));

    const scrollSections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scroll-track]")
    );
    const horizontalSections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-horizontal]")
    );
    const parallaxElements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-parallax]")
    );
    const transitionSections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-transition]")
    );

    let targetScroll = window.scrollY;
    let renderedScroll = window.scrollY;
    let smoothing = false;
    let previousScroll = window.scrollY;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let cursorX = pointerX;
    let cursorY = pointerY;
    let cursorVisible = false;
    let animationFrame = 0;

    const updateCursorMode = (target: EventTarget | null) => {
      if (!cursor || !(target instanceof Element)) return;

      const interactive = target.closest<HTMLElement>(
        "a, button, input, textarea, select, [data-cursor]"
      );
      const mode = interactive?.dataset.cursor ?? (interactive ? "link" : "default");
      cursor.dataset.mode = mode;

      if (cursorLabel) {
        cursorLabel.textContent = mode === "link" || mode === "default" ? "" : mode;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      cursorVisible = true;
      cursor?.setAttribute("data-visible", "true");
      root.style.setProperty(
        "--rr-pointer-x",
        String((event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2)
      );
      root.style.setProperty(
        "--rr-pointer-y",
        String((event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2)
      );
    };

    const handlePointerLeave = () => {
      cursorVisible = false;
      cursor?.removeAttribute("data-visible");
    };

    const handleScroll = () => {
      if (!smoothing) {
        targetScroll = window.scrollY;
        renderedScroll = window.scrollY;
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (!smoothEnabled || isNativeScrollTarget(event.target) || event.ctrlKey) return;

      event.preventDefault();
      const multiplier =
        event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? window.innerHeight : 1;
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );

      targetScroll = clamp(
        targetScroll + event.deltaY * multiplier * 0.92,
        0,
        maxScroll
      );
      smoothing = true;
    };

    const updateScrollScenes = () => {
      const viewportHeight = Math.max(1, window.innerHeight);
      const viewportWidth = Math.max(1, window.innerWidth);
      const scrollY = window.scrollY;

      root.toggleAttribute("data-scrolled", scrollY > 24);
      root.dataset.scrollDirection = scrollY >= previousScroll ? "down" : "up";
      previousScroll = scrollY;

      for (const section of scrollSections) {
        const rect = section.getBoundingClientRect();
        const start = rect.top + scrollY;
        const distance = Math.max(1, section.offsetHeight - viewportHeight);
        const progress = clamp((scrollY - start) / distance);
        section.style.setProperty("--scroll-progress", progress.toFixed(4));
      }

      for (const section of horizontalSections) {
        const stage = section.querySelector<HTMLElement>("[data-horizontal-stage]");
        const track = section.querySelector<HTMLElement>("[data-horizontal-track]");
        if (!stage || !track) continue;

        const rect = section.getBoundingClientRect();
        const start = rect.top + scrollY;
        const distance = Math.max(1, section.offsetHeight - viewportHeight);
        const progress = clamp((scrollY - start) / distance);
        const travel = Math.max(0, track.scrollWidth - viewportWidth + 48);
        const itemCount = track.querySelectorAll("[data-horizontal-item]").length;
        const active = Math.min(
          Math.max(1, Math.round(progress * Math.max(0, itemCount - 1)) + 1),
          Math.max(1, itemCount)
        );

        track.style.transform = `translate3d(${-progress * travel}px, 0, 0)`;
        section.style.setProperty("--horizontal-progress", progress.toFixed(4));
        section.querySelectorAll<HTMLElement>("[data-horizontal-index]").forEach((node) => {
          node.textContent = String(active).padStart(2, "0");
        });
      }

      for (const element of parallaxElements) {
        const rect = element.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const normalized = clamp((center - viewportHeight / 2) / viewportHeight, -1, 1);
        const amount = Number(element.dataset.parallax || 32);
        element.style.setProperty("--parallax-y", `${-normalized * amount}px`);
      }

      let transition = 0;
      for (const section of transitionSections) {
        const distance = Math.abs(section.getBoundingClientRect().top);
        transition = Math.max(
          transition,
          clamp(1 - distance / Math.max(1, viewportHeight * 0.28))
        );
      }
      root.style.setProperty("--rr-transition", (transition * 0.62).toFixed(3));
    };

    const tick = () => {
      if (smoothing) {
        renderedScroll += (targetScroll - renderedScroll) * 0.115;
        if (Math.abs(targetScroll - renderedScroll) < 0.45) {
          renderedScroll = targetScroll;
          smoothing = false;
        }
        window.scrollTo(0, renderedScroll);
      }

      if (cursor && finePointer.matches) {
        cursorX += (pointerX - cursorX) * 0.16;
        cursorY += (pointerY - cursorY) * 0.16;
        cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0) translate(-50%, -50%)`;
        cursor.toggleAttribute("data-visible", cursorVisible);
      }

      updateScrollScenes();
      animationFrame = window.requestAnimationFrame(tick);
    };

    const handlePointerOver = (event: PointerEvent) => updateCursorMode(event.target);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerover", handlePointerOver, { passive: true });
    document.documentElement.addEventListener("mouseleave", handlePointerLeave);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: false });
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      revealObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerover", handlePointerOver);
      document.documentElement.removeEventListener("mouseleave", handlePointerLeave);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
      document.body.classList.remove("rr-smooth-enabled");
      root.classList.remove("rr-motion-ready");
      root.removeAttribute("data-scrolled");
      root.removeAttribute("data-scroll-direction");
      root.style.removeProperty("--rr-pointer-x");
      root.style.removeProperty("--rr-pointer-y");
      root.style.removeProperty("--rr-transition");
    };
  }, [pathname]);

  return (
    <>
      {pathname === "/" ? (
        <div aria-hidden="true" className="rr-loader">
          <div className="rr-loader-runner"><i /><i /><i /></div>
          <span>RXNCOR / Loading the frames</span>
        </div>
      ) : null}
      <div aria-hidden="true" className="rr-site-noise" />
      <div aria-hidden="true" className="rr-scroll-transition" />
      <div aria-hidden="true" className="rr-cursor-orb" data-mode="default">
        <span />
      </div>
    </>
  );
}
