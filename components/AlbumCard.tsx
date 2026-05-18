import Link from "next/link";
import type { CSSProperties } from "react";

type AlbumCardProps = {
  title: string;
  slug: string;
  date: string;
  count: number;
  colors?: string[];
  coverUrl?: string | null;
};

export function AlbumCard({
  title,
  slug,
  date,
  count,
  colors = ["#713d2f", "#d8b35f"],
  coverUrl
}: AlbumCardProps) {
  return (
    <Link className="album-card" href={`/client/${slug}`}>
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="photo-img" src={coverUrl} alt={title} />
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
      <div className="album-meta">
        <p className="eyebrow">{date}</p>
        <h3>{title}</h3>
        <p>{count} photos</p>
      </div>
    </Link>
  );
}
