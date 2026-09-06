"use client";

import { useEffect } from "react";

export function DocumentViewTracker({ token }: { token: string }) {
  useEffect(() => {
    const body = JSON.stringify({ token });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/invoice-view", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/invoice-view", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    });
  }, [token]);

  return null;
}
