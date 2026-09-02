import type { ReactNode } from "react";

type PublicPageHeroProps = {
  eyebrow: string;
  index: string;
  title: string;
  description: string;
  tone?: "paper" | "orange" | "dark";
  meta?: string[];
  children?: ReactNode;
};

export function PublicPageHero({
  eyebrow,
  index,
  title,
  description,
  tone = "paper",
  meta = [],
  children
}: PublicPageHeroProps) {
  return (
    <section className="rx-subhero" data-tone={tone}>
      <div className="rx-grain" aria-hidden="true" />
      <div className="rx-crop rx-crop-nw" aria-hidden="true" />
      <div className="rx-crop rx-crop-ne" aria-hidden="true" />
      <div className="rx-subhero-top">
        <span>{eyebrow}</span>
        <span>{index}</span>
      </div>
      <h1>{title}</h1>
      <div className="rx-subhero-bottom">
        <p>{description}</p>
        {meta.length ? (
          <div className="rx-subhero-meta" aria-label="Page details">
            {meta.map((item) => <span key={item}>{item}</span>)}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
