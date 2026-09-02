"use client";

import { useEffect, useState } from "react";

const formatter = new Intl.DateTimeFormat("en-AU", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Australia/Melbourne"
});

function melbourneTime() {
  return formatter.format(new Date());
}

export function MelbourneClock() {
  const [time, setTime] = useState("--:--:--");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setTime(melbourneTime()));
    const timer = window.setInterval(() => setTime(melbourneTime()), 1_000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <span aria-label={`Current Melbourne time ${time}`} suppressHydrationWarning>
      MEL {time}
    </span>
  );
}
