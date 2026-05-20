"use client";

import { useState } from "react";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function AlbumSlugFields() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <>
      <label className="field">
        Album title
        <input
          name="title"
          placeholder="Chaya Birthday 2026"
          required
          value={title}
          onChange={(event) => {
            const nextTitle = event.target.value;
            setTitle(nextTitle);

            if (!slugEdited) {
              setSlug(slugify(nextTitle));
            }
          }}
        />
      </label>
      <label className="field">
        Slug
        <input
          name="slug"
          pattern="[a-z0-9-]+"
          placeholder="Auto-generated from album title"
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(slugify(event.target.value));
          }}
        />
        <small>
          This is generated automatically. Edit only if you want a custom client
          link.
        </small>
      </label>
    </>
  );
}
