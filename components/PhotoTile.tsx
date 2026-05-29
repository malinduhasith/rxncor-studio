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
    <article className="photo-tile">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="photo-img"
          src={imageUrl}
          alt={title}
          loading={loading}
          decoding="async"
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
