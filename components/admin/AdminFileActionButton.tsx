"use client";

import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";

type AdminFileActionButtonProps = {
  albumId: string;
  photoId: string;
  kind: "preview" | "full";
};

export function AdminFileActionButton({
  albumId,
  photoId,
  kind
}: AdminFileActionButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const label = kind === "preview" ? "Preview" : "Full";
  const Icon = kind === "preview" ? ExternalLink : Download;

  async function handleClick() {
    if (status === "loading") {
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/admin/file-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          album_id: albumId,
          photo_id: photoId,
          kind
        })
      });

      if (!response.ok) {
        throw new Error("Could not create file link.");
      }

      const payload = (await response.json()) as { url: string };

      if (kind === "preview") {
        window.open(payload.url, "_blank", "noopener,noreferrer");
      } else {
        window.location.assign(payload.url);
      }

      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <button
      className={`button secondary small ${status === "error" ? "danger" : ""}`}
      onClick={handleClick}
      type="button"
    >
      <Icon size={16} />
      {status === "loading" ? "Opening" : status === "error" ? "Retry" : label}
    </button>
  );
}
