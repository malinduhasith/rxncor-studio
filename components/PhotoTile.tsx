import type { CSSProperties } from "react";

type PhotoTileProps = {
  title: string;
  meta: string;
  detail?: string;
  filename?: string;
  eyebrow?: string;
  colors?: string[];
  imageUrl?: string | null;
};

export function PhotoTile({
  title,
  meta,
  detail,
  filename,
  eyebrow = "Selected frame",
  colors = ["#713d2f", "#d8b35f"],
  imageUrl
}: PhotoTileProps) {
  return (
    <article className="photo-tile">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="photo-img"
          src={imageUrl}
          alt={title}
          loading="lazy"
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
      <div className="tile-caption">
        <span>
          <small>{eyebrow}</small>
          <strong>{title}</strong>
          {detail ? <em>{detail}</em> : null}
          {filename ? <code>{filename}</code> : null}
        </span>
        <span>{meta}</span>
      </div>
    </article>
  );
}
