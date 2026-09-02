import type { CSSProperties } from "react";
import Image from "next/image";
import { CompositionMark } from "@/components/home/CompositionMark";

export type FrameReelItem = {
  id: string;
  title: string;
  meta: string;
  detail: string;
  imageUrl: string | null;
  cameraModel?: string | null;
  lensModel?: string | null;
  focalLength?: string | null;
  aperture?: string | null;
  shutterSpeed?: string | null;
  iso?: string | null;
};

type FrameReelProps = {
  frames: FrameReelItem[];
};

function exposureValue(label: "Aperture" | "ISO", value: string | null | undefined) {
  if (!value) return null;
  if (label === "ISO") return /^iso/i.test(value) ? value : `ISO ${value}`;
  if (/^(f\/|ƒ\/)/i.test(value)) return value;
  if (/^f\d/i.test(value)) return value.replace(/^f/i, "f/");
  return `f/${value}`;
}

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
          <CompositionMark className="rr-composition-plane rr-composition-thirds" variant="thirds" />
          <CompositionMark className="rr-composition-plane rr-composition-golden" variant="spiral" />
          <CompositionMark className="rr-composition-plane rr-composition-triangles" variant="triangles" />
          <CompositionMark className="rr-composition-plane rr-composition-radial" variant="radial" />
        </div>

        <div className="rr-horizontal-viewport">
          <div className="rr-frame-track" data-horizontal-track>
            {frames.map((frame, index) => {
              const settings = [
                { label: "Body", value: frame.cameraModel },
                { label: "Lens", value: frame.lensModel },
                { label: "Focal", value: frame.focalLength },
                { label: "Aperture", value: exposureValue("Aperture", frame.aperture) },
                { label: "Shutter", value: frame.shutterSpeed },
                { label: "Sensitivity", value: exposureValue("ISO", frame.iso) }
              ].filter((setting) => setting.value);

              return <article
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
                  <dl className="rr-frame-settings">
                    {settings.length ? settings.map((setting) => (
                      <div key={setting.label}>
                        <dt>{setting.label}</dt>
                        <dd>{setting.value}</dd>
                      </div>
                    )) : (
                      <div className="rr-frame-settings-empty">
                        <dt>Capture data</dt>
                        <dd>Metadata not recorded</dd>
                      </div>
                    )}
                  </dl>
                  <p>{frame.detail}</p>
                </div>
              </article>;
            })}
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
