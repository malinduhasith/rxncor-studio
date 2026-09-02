import { CompositionMark } from "@/components/home/CompositionMark";

const marks = [
  ["sensor", "rr-hero-tech-sensor"],
  ["perspective", "rr-hero-tech-perspective"],
  ["focus", "rr-hero-tech-focus"],
  ["meter", "rr-hero-tech-meter"],
  ["waveform", "rr-hero-tech-waveform"],
  ["thirds", "rr-hero-tech-thirds"],
  ["spiral", "rr-hero-tech-spiral"],
  ["triangles", "rr-hero-tech-triangles"],
  ["radial", "rr-hero-tech-radial"],
  ["tunnel", "rr-hero-tech-tunnel"],
  ["v", "rr-hero-tech-v"]
] as const;

const readings = [
  ["BODY", "ILCE-7M4"],
  ["OPTIC", "85 MM"],
  ["IRIS", "F / 1.4"],
  ["TIME", "1 / 200"],
  ["GAIN", "ISO 2500"],
  ["WB", "5600 K"]
] as const;

export function HeroVectorField() {
  return (
    <div aria-hidden="true" className="rr-hero-vector-field">
      {marks.map(([variant, className], index) => (
        <div className={`rr-hero-tech-layer ${className}`} key={variant}>
          <CompositionMark className="rr-hero-tech-mark" variant={variant} />
          <i>{String(index + 1).padStart(2, "0")}</i>
        </div>
      ))}

      <div className="rr-hero-readout">
        {readings.map(([label, value]) => (
          <span key={label}>
            <small>{label}</small>
            <b>{value}</b>
          </span>
        ))}
      </div>

      <div className="rr-hero-scanline" />
      <div className="rr-hero-coordinate rr-hero-coordinate-a">X 37.8136° / Y 144.9631°</div>
      <div className="rr-hero-coordinate rr-hero-coordinate-b">AF-C / TRACKING / ACTIVE</div>
      <div className="rr-hero-particles">
        {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
      </div>
    </div>
  );
}
