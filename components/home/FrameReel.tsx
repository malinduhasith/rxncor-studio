"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type FrameReelItem = {
  id: string;
  title: string;
  meta: string;
  detail: string;
  imageUrl: string | null;
};

type FrameReelProps = {
  frames: FrameReelItem[];
};

export function FrameReel({ frames }: FrameReelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) {
          return;
        }

        const index = Number((visible.target as HTMLElement).dataset.index ?? 0);
        setActiveIndex(index);
      },
      { rootMargin: "-38% 0px -38%", threshold: [0, 0.2, 0.5, 0.8, 1] }
    );

    const steps = stepRefs.current;
    steps.forEach((step) => step && observer.observe(step));

    return () => observer.disconnect();
  }, [frames.length]);

  const activeFrame = frames[activeIndex] ?? frames[0];

  if (!activeFrame) {
    return null;
  }

  return (
    <section className="rx-reel" id="frames">
      <div className="rx-reel-stage">
        <div className="rx-section-kicker rx-reel-kicker">
          <span>Selected frames</span>
          <span>Scroll to explore</span>
        </div>
        <h2>FRAMES</h2>
        <div className="rx-reel-display" aria-live="polite">
          <div className="rx-reel-ghost" aria-hidden="true">
            {String(activeIndex + 1).padStart(2, "0")}
          </div>
          <div className="rx-reel-image" key={activeFrame.id}>
            {activeFrame.imageUrl ? (
              <Image
                alt={activeFrame.title}
                fill
                sizes="(max-width: 800px) 76vw, 38vw"
                src={activeFrame.imageUrl}
                unoptimized
              />
            ) : (
              <div className="rx-image-fallback" aria-hidden="true" />
            )}
          </div>
          <div className="rx-reel-index">
            <span>{String(activeIndex + 1).padStart(2, "0")}</span>
            <i />
            <span>{String(frames.length).padStart(2, "0")}</span>
          </div>
          <div className="rx-reel-caption">
            <span>{activeFrame.meta}</span>
            <strong>{activeFrame.title}</strong>
            <small>{activeFrame.detail}</small>
          </div>
        </div>
      </div>
      <div className="rx-reel-steps" aria-hidden="true">
        {frames.map((frame, index) => (
          <div
            className="rx-reel-step"
            data-index={index}
            key={frame.id}
            ref={(element) => {
              stepRefs.current[index] = element;
            }}
          />
        ))}
      </div>
    </section>
  );
}
