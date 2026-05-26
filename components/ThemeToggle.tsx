"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const storageKey = "rxncor_theme_v1";
const themeChangeEvent = "rxncor:theme-changed";

function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark";
}

function systemTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function storedTheme(): ThemeMode | null {
  try {
    const value = localStorage.getItem(storageKey);
    return isThemeMode(value) ? value : null;
  } catch {
    return null;
  }
}

function getInitialTheme(): ThemeMode {
  if (typeof document === "undefined") {
    return "light";
  }

  const appliedTheme = document.documentElement.dataset.theme;

  if (isThemeMode(appliedTheme)) {
    return appliedTheme;
  }

  return storedTheme() ?? systemTheme();
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;

  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // The visual theme can still be applied even if storage is blocked.
  }

  window.dispatchEvent(
    new CustomEvent(themeChangeEvent, {
      detail: { theme }
    })
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const isDark = theme === "dark";
  const nextTheme = isDark ? "light" : "dark";

  useEffect(() => {
    function syncTheme() {
      const resolvedTheme = getInitialTheme();

      if (!isThemeMode(document.documentElement.dataset.theme)) {
        document.documentElement.setAttribute("data-theme", resolvedTheme);
        document.documentElement.style.colorScheme = resolvedTheme;
      }

      setTheme(resolvedTheme);
    }

    const frame = window.requestAnimationFrame(syncTheme);
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true
    });
    window.addEventListener("storage", syncTheme);
    window.addEventListener(themeChangeEvent, syncTheme);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener(themeChangeEvent, syncTheme);
    };
  }, []);

  function handleToggle() {
    const liveTheme = getInitialTheme();
    const updatedTheme = liveTheme === "dark" ? "light" : "dark";

    applyTheme(updatedTheme);
    setTheme(updatedTheme);
  }

  return (
    <button
      aria-label={`Switch to ${nextTheme} mood`}
      aria-pressed={isDark}
      className="theme-toggle"
      onClick={handleToggle}
      suppressHydrationWarning
      type="button"
    >
      {isDark ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
