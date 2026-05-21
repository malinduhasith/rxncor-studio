"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MAX_PENDING_MS = 12_000;

function cleanLabel(value: string | null | undefined, fallback: string) {
  const label = value?.replace(/\s+/g, " ").trim();

  return label ? label.slice(0, 42) : fallback;
}

function isTrackableLink(anchor: HTMLAnchorElement) {
  if (anchor.dataset.noPending === "true") {
    return false;
  }

  const href = anchor.getAttribute("href");

  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  if (anchor.target && anchor.target !== "_self") {
    return false;
  }

  if (anchor.hasAttribute("download")) {
    return false;
  }

  const nextUrl = new URL(anchor.href, window.location.href);
  const currentUrl = new URL(window.location.href);

  if (nextUrl.origin !== currentUrl.origin) {
    return false;
  }

  return nextUrl.pathname !== currentUrl.pathname || nextUrl.search !== currentUrl.search;
}

export function PendingInteraction() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = useMemo(() => searchParams.toString(), [searchParams]);
  const [pending, setPending] = useState(false);
  const [label, setLabel] = useState("Working");
  const timeoutRef = useRef<number | null>(null);

  const clearPending = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    document.body.classList.remove("is-interaction-pending");
    document.body.removeAttribute("aria-busy");
    document
      .querySelectorAll<HTMLElement>("[data-pending='true']")
      .forEach((element) => {
        delete element.dataset.pending;
      });
    setPending(false);
  }, []);

  const startPending = useCallback((nextLabel: string) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    document.body.classList.add("is-interaction-pending");
    document.body.setAttribute("aria-busy", "true");
    setLabel(nextLabel);
    setPending(true);
    timeoutRef.current = window.setTimeout(clearPending, MAX_PENDING_MS);
  }, [clearPending]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(clearPending);

    return () => window.cancelAnimationFrame(frame);
  }, [pathname, search, clearPending]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");

      if (!anchor || !isTrackableLink(anchor)) {
        return;
      }

      anchor.dataset.pending = "true";
      startPending(
        `Opening ${cleanLabel(
          anchor.dataset.pendingLabel ?? anchor.getAttribute("aria-label") ?? anchor.textContent,
          "next view"
        )}`
      );
    }

    function handleSubmit(event: SubmitEvent) {
      if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) {
        return;
      }

      const form = event.target;

      if (!form.checkValidity()) {
        return;
      }

      form.dataset.pending = "true";
      const submitter =
        event.submitter instanceof HTMLElement ? event.submitter : null;
      submitter?.setAttribute("data-pending", "true");
      startPending(
        cleanLabel(
          submitter?.dataset.pendingLabel ??
            submitter?.getAttribute("aria-label") ??
            submitter?.textContent,
          "Working"
        )
      );
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, [startPending]);

  useEffect(() => clearPending, [clearPending]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pending-indicator"
      data-visible={pending ? "true" : "false"}
      role="status"
    >
      <div className="pending-card">
        <p className="pending-eyebrow">Loading</p>
        <h2>Working on it</h2>
        <p className="pending-indicator-label">{label}</p>
        <span className="pending-indicator-track" />
      </div>
    </div>
  );
}
