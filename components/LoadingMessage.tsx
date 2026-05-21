"use client";

import { useEffect, useState } from "react";

import { LOADING_DETAILS, LOADING_LINES } from "@/lib/loading-copy";

type LoadingMessageProps = {
  as?: "h1" | "h2";
  detailClassName?: string;
  intervalMs?: number;
  showDetail?: boolean;
  startIndex?: number;
};

export function LoadingMessage({
  as: Heading = "h2",
  detailClassName,
  intervalMs = 1_250,
  showDetail = true,
  startIndex = 0,
}: LoadingMessageProps) {
  const [index, setIndex] = useState(
    () => Math.abs(startIndex) % LOADING_LINES.length
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((currentIndex) => (currentIndex + 1) % LOADING_LINES.length);
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [intervalMs]);

  return (
    <>
      <Heading>{LOADING_LINES[index]}</Heading>
      {showDetail ? (
        <p className={detailClassName}>
          {LOADING_DETAILS[index % LOADING_DETAILS.length]}
        </p>
      ) : null}
    </>
  );
}
