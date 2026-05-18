import Link from "next/link";
import type { CSSProperties } from "react";

type AlbumCardProps = {
  title: string;
  slug: string;
  date: string;
  count: number;
  colors: string[];
};

export function AlbumCard({ title, slug, date, count, colors }: AlbumCardProps) {
  return (
    <Link className="album-card" href={`/client/${slug}`}>
      <div
        className="photo-fill"
        style={
          {
            "--tile-a": colors[0],
            "--tile-b": colors[1]
          } as CSSProperties
        }
      />
      <div className="album-meta">
        <p className="eyebrow">{date}</p>
        <h3>{title}</h3>
        <p>{count} photos</p>
      </div>
    </Link>
  );
}
