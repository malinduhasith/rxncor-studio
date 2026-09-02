import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export type ProjectRailItem = {
  id: string;
  title: string;
  slug: string;
  date: string;
  count: number;
  coverUrl: string | null;
};

type ProjectRailProps = {
  projects: ProjectRailItem[];
};

export function ProjectRail({ projects }: ProjectRailProps) {
  if (!projects.length) return null;

  return (
    <section
      className="rr-horizontal rr-project-rail"
      data-horizontal
      data-scroll-track
      data-transition
      id="work"
      style={{ "--rr-item-count": projects.length } as CSSProperties}
    >
      <div className="rr-horizontal-sticky rr-project-sticky" data-horizontal-stage>
        <div className="rr-horizontal-heading rr-project-heading">
          <div>
            <span>Recent stories / 03</span>
            <span>Public albums</span>
          </div>
          <h2>WORK</h2>
          <div className="rr-horizontal-counter" aria-hidden="true">
            <span data-horizontal-index>01</span>
            <i />
            <span>{String(projects.length).padStart(2, "0")}</span>
          </div>
        </div>

        <div className="rr-horizontal-viewport rr-project-viewport">
          <div className="rr-project-track" data-horizontal-track>
            {projects.map((project, index) => (
              <article className="rr-project-card" data-horizontal-item key={project.id}>
                <Link
                  aria-label={`Open ${project.title}`}
                  className="rr-project-media"
                  data-cursor="Open"
                  href={`${siteConfig.routes.clientGallery}/${project.slug}`}
                >
                  {project.coverUrl ? (
                    <Image
                      alt={project.title}
                      fill
                      sizes="(max-width: 760px) 84vw, 58vw"
                      src={project.coverUrl}
                      unoptimized
                    />
                  ) : (
                    <div className="rx-image-fallback" aria-hidden="true" />
                  )}
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </Link>
                <div className="rr-project-meta">
                  <span>{project.date}</span>
                  <h3>{project.title}</h3>
                  <p>{project.count} photographs / Melbourne and beyond</p>
                  <Link href={`${siteConfig.routes.clientGallery}/${project.slug}`}>
                    View story <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>

        <Link className="rr-all-work" href={siteConfig.routes.albums}>
          All public albums <span aria-hidden="true">↗</span>
        </Link>
        <div className="rr-horizontal-progress" aria-hidden="true"><i /></div>
      </div>
    </section>
  );
}
