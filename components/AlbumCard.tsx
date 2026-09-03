import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CompositionMark } from "@/components/home/CompositionMark";

type AlbumCardProps = {
  title: string;
  slug: string;
  date: string;
  count: number;
  colors?: string[];
  coverUrl?: string | null;
  loading?: "eager" | "lazy";
  index?: number;
};

export function AlbumCard({
  title,
  slug,
  date,
  count,
  colors = ["#713d2f", "#d8b35f"],
  coverUrl,
  loading = "lazy",
  index
}: AlbumCardProps) {
  const cardVariants = ["thirds", "spiral", "triangles", "radial", "curve", "v"] as const;
  const cardVariant = cardVariants[(index ?? 0) % cardVariants.length];

  return (
    <Link
      aria-label={`Open ${title}`}
      className="album-card rx-album-card"
      data-pending-label={title}
      href={`/client/${slug}`}
    >
      <div className="rx-album-card-media">
        {coverUrl ? (
          <Image
            alt={title}
            className="photo-img"
            fill
            loading={loading}
            sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
            src={coverUrl}
            unoptimized
          />
        ) : (
          <div
            className="photo-fill"
            style={
              {
                "--tile-a": colors[0],
                "--tile-b": colors[1]
              } as CSSProperties
            }
          />
        )}
      </div>
      <div aria-hidden="true" className="rx-album-card-vectors">
        <CompositionMark className="rx-album-card-composition" variant={cardVariant} />
        <CompositionMark className="rx-album-card-focus" variant="focus" />
      </div>
      <div aria-hidden="true" className="rx-album-card-telemetry">
        <span>AF-C / TRACK</span>
        <span>GRID / ACTIVE</span>
        <span>{String(count).padStart(3, "0")} FRAMES</span>
      </div>
      <div className="album-card-top">
        <span>{index === undefined ? "Archive" : String(index + 1).padStart(2, "0")}</span>
        <span>{date}</span>
      </div>
      <div className="album-meta">
        <p className="eyebrow">Story / Client project</p>
        <h3>{title}</h3>
        <p>{count} photographs</p>
        <span className="rx-album-arrow" aria-hidden="true">↗</span>
      </div>
    </Link>
  );
}
