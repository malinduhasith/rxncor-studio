import Link from "next/link";
import type { CSSProperties } from "react";

type AlbumCardProps = {
  title: string;
  slug: string;
  date: string;
  count: number;
  colors?: string[];
  coverUrl?: string | null;
  loading?: "eager" | "lazy";
};

export function AlbumCard({
  title,
  slug,
  date,
  count,
  colors = ["#713d2f", "#d8b35f"],
  coverUrl,
  loading = "lazy"
}: AlbumCardProps) {
  return (
    <Link
      aria-label={`Open ${title}`}
      className="album-card"
      data-pending-label={title}
      href={`/client/${slug}`}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="photo-img"
          src={coverUrl}
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
      <div className="album-card-top">
        <span>Archive</span>
        <span>{date}</span>
      </div>
      <div className="album-meta">
        <p className="eyebrow">Client project</p>
        <h3>{title}</h3>
        <p>{count} photos · private delivery ready</p>
      </div>
    </Link>
  );
}
