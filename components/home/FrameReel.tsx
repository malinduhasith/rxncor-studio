import type { CSSProperties } from "react";
import Image from "next/image";

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
  if (!frames.length) return null;

  return (
    <section
      aria-label="Selected photography"
      className="rr-horizontal rr-frame-reel"
      data-horizontal
      data-scroll-track
      data-transition
      id="frames"
      style={{
        "--rr-item-count": frames.length,
        "--rr-scroll-height": `${Math.max(205, 100 + frames.length * 52)}svh`
      } as CSSProperties}
    >
      <div className="rr-horizontal-sticky" data-horizontal-stage>
        <div className="rr-horizontal-heading">
          <div>
            <span>Selected frames / 02</span>
            <span>Scroll to run the reel</span>
          </div>
          <h2>FRAMES</h2>
          <div className="rr-horizontal-counter" aria-hidden="true">
            <span data-horizontal-index>01</span>
            <i />
            <span>{String(frames.length).padStart(2, "0")}</span>
          </div>
        </div>

        <div className="rr-frame-manifesto">
          <span>Melbourne / image studies</span>
          <h3>
            Light.<br />
            Motion.<br />
            Machine.
          </h3>
          <p>
            A working archive of observed light, controlled motion and honest
            moments—photographed with a technical eye and a quiet approach.
          </p>
          <div aria-hidden="true">
            <i />
            <span>Scroll / explore</span>
          </div>
        </div>

        <div className="rr-composition-rig" aria-hidden="true">
          <span className="rr-composition-label">Composition / geometry / light</span>

          <svg className="rr-composition-plane rr-composition-thirds" viewBox="0 0 600 400">
            <rect x="16" y="16" width="568" height="368" rx="7" />
            <path d="M205 16v368M395 16v368M16 139h568M16 261h568" />
            <circle cx="205" cy="139" r="7" />
            <circle cx="395" cy="261" r="7" />
          </svg>

          <svg className="rr-composition-plane rr-composition-golden" viewBox="0 0 600 400">
            <rect x="16" y="16" width="568" height="368" rx="7" />
            <path d="M367 16v368M367 157h217M501 157v227M367 297h134M450 297v87" />
            <path d="M16 384C16 181 181 16 384 16c111 0 200 90 200 200 0 93-75 168-168 168-77 0-140-63-140-140 0-64 52-116 116-116 53 0 96 43 96 96 0 44-36 80-80 80-36 0-66-30-66-66 0-30 24-54 54-54" />
          </svg>

          <svg className="rr-composition-plane rr-composition-triangles" viewBox="0 0 600 400">
            <rect x="16" y="16" width="568" height="368" rx="7" />
            <path d="M16 384 584 16M16 16l248 368M584 384 398 16" />
            <circle cx="300" cy="200" r="9" />
          </svg>

          <svg className="rr-composition-plane rr-composition-radial" viewBox="0 0 600 400">
            <rect x="16" y="16" width="568" height="368" rx="7" />
            <path d="M300 200 16 16M300 200 110 16M300 200 205 16M300 200 300 16M300 200 395 16M300 200 490 16M300 200 584 16M300 200 584 108M300 200 584 200M300 200 584 292M300 200 584 384M300 200 490 384M300 200 395 384M300 200 300 384M300 200 205 384M300 200 110 384M300 200 16 384M300 200 16 292M300 200 16 200M300 200 16 108" />
            <circle cx="300" cy="200" r="31" />
          </svg>
        </div>

        <div className="rr-horizontal-viewport">
          <div className="rr-frame-track" data-horizontal-track>
            {frames.map((frame, index) => (
              <article
                className="rr-frame-card"
                data-cursor="View"
                data-horizontal-item
                key={frame.id}
              >
                <div className="rr-frame-card-media">
                  {frame.imageUrl ? (
                    <Image
                      alt={frame.title}
                      fill
                      loading={index < 2 ? "eager" : "lazy"}
                      quality={78}
                      sizes="(max-width: 760px) 82vw, 62vw"
                      src={frame.imageUrl}
                    />
                  ) : (
                    <div className="rx-image-fallback" aria-hidden="true" />
                  )}
                  <span>{String(index + 1).padStart(3, "0")}</span>
                </div>
                <div className="rr-frame-card-copy">
                  <span>{frame.meta}</span>
                  <div className="rr-frame-card-gauge" aria-hidden="true">
                    <span>RX / {String(index + 1).padStart(3, "0")}</span>
                    <i />
                    <i />
                    <i />
                  </div>
                  <h3>{frame.title}</h3>
                  <p>{frame.detail}</p>
                </div>
              </article>
            ))}
            <div className="rr-frame-end">
              <span>Keep going</span>
              <strong>More stories below.</strong>
              <i aria-hidden="true">↓</i>
            </div>
          </div>
        </div>

        <div className="rr-horizontal-progress" aria-hidden="true"><i /></div>
      </div>
    </section>
  );
}
