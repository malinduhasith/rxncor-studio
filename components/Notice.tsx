"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { NoticeContent, NoticeTone } from "@/lib/notices";

const noticeIcons = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info
} satisfies Record<NoticeTone, typeof CircleCheck>;

type NoticeProps = {
  notice?: NoticeContent | null;
  className?: string;
};

export function Notice({ notice, className = "" }: NoticeProps) {
  if (!notice) {
    return null;
  }

  const Icon = noticeIcons[notice.tone];
  const role = notice.tone === "error" ? "alert" : "status";

  return (
    <div className={`alert ${notice.tone} ${className}`.trim()} role={role}>
      <Icon aria-hidden="true" size={20} />
      <span>
        <strong>{notice.title}</strong>
        <span>{notice.message}</span>
      </span>
    </div>
  );
}

type NoticeStackProps = {
  notices: Array<NoticeContent | null | undefined>;
};

export function NoticeStack({ notices }: NoticeStackProps) {
  const visibleNotices = notices.filter((notice): notice is NoticeContent =>
    Boolean(notice)
  );

  if (!visibleNotices.length) {
    return null;
  }

  return (
    <div className="notice-stack">
      {visibleNotices.map((notice, index) => (
        <Notice
          // Titles can repeat, but their position in the stack is stable for a page render.
          key={`${notice.tone}-${notice.title}-${index}`}
          notice={notice}
        />
      ))}
    </div>
  );
}

type NoticeToasterProps = {
  notices: Array<NoticeContent | null | undefined>;
  cleanupQueryKeys?: string[];
  autoDismissMs?: number;
};

function toastId(notice: NoticeContent, index: number) {
  return `${notice.tone}:${notice.title}:${notice.message}:${index}`;
}

function toastDuration(notice: NoticeContent, autoDismissMs: number) {
  if (notice.tone === "error" || notice.tone === "warning") {
    return autoDismissMs + 1800;
  }

  return autoDismissMs;
}

export function NoticeToaster({
  notices,
  cleanupQueryKeys = [],
  autoDismissMs = 3600
}: NoticeToasterProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const cleanupKey = cleanupQueryKeys.join("|");
  const toastNotices = useMemo(
    () =>
      notices
        .filter((notice): notice is NoticeContent => Boolean(notice))
        .map((notice, index) => ({
          ...notice,
          id: toastId(notice, index)
        })),
    [notices]
  );
  const visibleNotices = useMemo(
    () => toastNotices.filter((notice) => !dismissed.has(notice.id)),
    [dismissed, toastNotices]
  );

  useEffect(() => {
    const timers = visibleNotices.map((notice) =>
      window.setTimeout(() => {
        setDismissed((current) => {
          const next = new Set(current);
          next.add(notice.id);
          return next;
        });
      }, toastDuration(notice, autoDismissMs))
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [autoDismissMs, visibleNotices]);

  useEffect(() => {
    if (!toastNotices.length || !cleanupKey) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const url = new URL(window.location.href);
      let changed = false;

      for (const key of cleanupQueryKeys) {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          changed = true;
        }
      }

      if (url.hash) {
        url.hash = "";
        changed = true;
      }

      if (changed) {
        window.history.replaceState(
          window.history.state,
          "",
          `${url.pathname}${url.search}${url.hash}`
        );
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [cleanupKey, cleanupQueryKeys, toastNotices.length]);

  if (!visibleNotices.length) {
    return null;
  }

  return (
    <div
      aria-label="Notifications"
      aria-live="polite"
      className="toast-viewport"
      role="region"
    >
      {visibleNotices.map((notice) => (
        <div className="toast-item" key={notice.id}>
          <Notice className="toast-alert" notice={notice} />
          <button
            aria-label={`Dismiss ${notice.title}`}
            className="toast-close"
            onClick={() =>
              setDismissed((current) => {
                const next = new Set(current);
                next.add(notice.id);
                return next;
              })
            }
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
