import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
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
