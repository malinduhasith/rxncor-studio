"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";

type ThemeMode = "light" | "dark";

const storageKey = "rxncor_theme_v1";

function getInitialTheme(): ThemeMode {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(storageKey, theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const isDark = theme === "dark";
  const nextTheme = isDark ? "light" : "dark";

  function handleToggle() {
    applyTheme(nextTheme);
    setTheme(nextTheme);
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
