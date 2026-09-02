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
      style={{ "--rr-item-count": frames.length } as CSSProperties}
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

        <div className="rr-frame-orbital" aria-hidden="true">
          <div className="rr-frame-orbital-core" />
          <i className="rr-frame-orbital-ring rr-frame-orbital-ring-a" />
          <i className="rr-frame-orbital-ring rr-frame-orbital-ring-b" />
          <i className="rr-frame-orbital-ring rr-frame-orbital-ring-c" />
          <span className="rr-frame-orbital-point rr-frame-orbital-point-a" />
          <span className="rr-frame-orbital-point rr-frame-orbital-point-b" />
          <span className="rr-frame-orbital-point rr-frame-orbital-point-c" />
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
