"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LoadingMessage } from "@/components/LoadingMessage";
import { LOADING_LINES } from "@/lib/loading-copy";

const MAX_PENDING_MS = 12_000;
const SCROLL_RESTORE_KEY = "rxncor_restore_scroll_v1";

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

function saveScrollRestorePoint() {
  try {
    window.sessionStorage.setItem(
      SCROLL_RESTORE_KEY,
      JSON.stringify({
        at: Date.now(),
        pathname: window.location.pathname,
        y: window.scrollY
      })
    );
  } catch {
    // Session storage may be unavailable in strict browser modes.
  }
}

function restoreScrollIfNeeded() {
  try {
    const raw = window.sessionStorage.getItem(SCROLL_RESTORE_KEY);

    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as {
      at?: number;
      pathname?: string;
      y?: number;
    };
    window.sessionStorage.removeItem(SCROLL_RESTORE_KEY);

    if (
      parsed.pathname !== window.location.pathname ||
      typeof parsed.y !== "number" ||
      Date.now() - Number(parsed.at ?? 0) > 30_000
    ) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: parsed.y, left: 0, behavior: "auto" });
    });
  } catch {
    window.sessionStorage.removeItem(SCROLL_RESTORE_KEY);
  }
}

export function PendingInteraction() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = useMemo(() => searchParams.toString(), [searchParams]);
  const [pending, setPending] = useState(false);
  const [label, setLabel] = useState("Working");
  const [lineStartIndex, setLineStartIndex] = useState(0);
  const timeoutRef = useRef<number | null>(null);
  const lineIndexRef = useRef(0);

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
    lineIndexRef.current = (lineIndexRef.current + 1) % LOADING_LINES.length;
    setLineStartIndex(lineIndexRef.current);
    setPending(true);
    timeoutRef.current = window.setTimeout(clearPending, MAX_PENDING_MS);
  }, [clearPending]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      clearPending();
      restoreScrollIfNeeded();
    });

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

      saveScrollRestorePoint();
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

      saveScrollRestorePoint();
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
        {pending ? (
          <LoadingMessage
            intervalMs={1_150}
            key={lineStartIndex}
            showDetail={false}
            startIndex={lineStartIndex}
          />
        ) : (
          <h2>{LOADING_LINES[0]}</h2>
        )}
        <p className="pending-indicator-label">{label}</p>
        <span className="pending-indicator-track" />
      </div>
    </div>
  );
}
