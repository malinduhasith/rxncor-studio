"use client";

import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";
import { Images, LockKeyhole, Send, Upload } from "lucide-react";
import styles from "@/app/admin/albums.module.css";

type Tab = "photos" | "upload" | "access" | "delivery";
const TabContext = createContext<((tab: Tab) => void) | null>(null);
const tabs = [
  { id: "photos", label: "Photos", icon: Images },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "access", label: "Access", icon: LockKeyhole },
  { id: "delivery", label: "Delivery", icon: Send },
] as const;

export function AlbumTabButton({ tab, children }: { tab: Tab; children: ReactNode }) {
  const select = useContext(TabContext);
  return <button className="button secondary" type="button" onClick={() => select?.(tab)}>{children}</button>;
}

export function AlbumWorkspaceTabs({ initialTab, ...panels }: { initialTab: Tab; photos: ReactNode; upload: ReactNode; access: ReactNode; delivery: ReactNode }) {
  const [active, setActive] = useState<Tab>(initialTab);
  const prefix = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function select(tab: Tab) {
    setActive(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("albumTab", tab);
    window.history.replaceState(null, "", url);
  }
  return <TabContext.Provider value={select}>
    <div className={styles.tabs} role="tablist" aria-label="Album workspace">
      {tabs.map(({ id, label, icon: Icon }, index) => <button
        key={id} id={`${prefix}-tab-${id}`} role="tab" type="button"
        ref={button => { buttons.current[index] = button; }}
        aria-selected={active === id} aria-controls={`${prefix}-panel-${id}`} tabIndex={active === id ? 0 : -1}
        onClick={() => select(id)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
          if (next === null) return;
          event.preventDefault(); select(tabs[next].id); buttons.current[next]?.focus();
        }}><Icon size={18} aria-hidden="true" />{label}</button>)}
    </div>
    {tabs.map(({ id }) => <div className={styles.tabPanel} key={id} id={`${prefix}-panel-${id}`} role="tabpanel" aria-labelledby={`${prefix}-tab-${id}`} hidden={active !== id}>{panels[id]}</div>)}
  </TabContext.Provider>;
}
