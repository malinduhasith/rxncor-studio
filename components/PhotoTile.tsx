import Image from "next/image";
import type { CSSProperties } from "react";

type PhotoTileProps = {
  title: string;
  meta: string;
  detail?: string;
  eyebrow?: string;
  colors?: string[];
  imageUrl?: string | null;
  loading?: "eager" | "lazy";
};

export function PhotoTile({
  title,
  meta,
  detail,
  eyebrow = "Selected frame",
  colors = ["#713d2f", "#d8b35f"],
  imageUrl,
  loading = "lazy"
}: PhotoTileProps) {
  return (
    <article className="photo-tile rx-photo-tile">
      {imageUrl ? (
        <Image
          alt={title}
          className="photo-img"
          fill
          loading={loading}
          sizes="(max-width: 760px) 50vw, 33vw"
          src={imageUrl}
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
      {detail ? <span className="tile-date-chip">{detail}</span> : null}
      <div className="tile-caption">
        <span className="tile-info">
          <strong className="tile-album">{meta}</strong>
          <small>{eyebrow}</small>
          <em className="tile-frame">{title}</em>
        </span>
      </div>
    </article>
  );
}
