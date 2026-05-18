import type { CSSProperties } from "react";

type PhotoTileProps = {
  title: string;
  meta: string;
  colors?: string[];
  imageUrl?: string | null;
};

export function PhotoTile({
  title,
  meta,
  colors = ["#713d2f", "#d8b35f"],
  imageUrl
}: PhotoTileProps) {
  return (
    <article className="photo-tile">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="photo-img" src={imageUrl} alt={title} />
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
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
    </article>
  );
}
