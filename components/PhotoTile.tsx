import type { CSSProperties } from "react";

type PhotoTileProps = {
  title: string;
  meta: string;
  colors: string[];
};

export function PhotoTile({ title, meta, colors }: PhotoTileProps) {
  return (
    <article className="photo-tile">
      <div
        className="photo-fill"
        style={
          {
            "--tile-a": colors[0],
            "--tile-b": colors[1]
          } as CSSProperties
        }
      />
      <div className="tile-caption">
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
    </article>
  );
}
