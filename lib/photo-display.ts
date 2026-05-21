export type PhotoDisplaySource = {
  filename: string;
  display_title?: string | null;
  caption?: string | null;
  camera_model?: string | null;
  lens_model?: string | null;
  focal_length?: string | null;
  aperture?: string | null;
  shutter_speed?: string | null;
  iso?: string | null;
  captured_at?: string | null;
  location?: string | null;
};

export type PhotoDisplayContext = {
  albumTitle?: string | null;
  eventDate?: string | null;
  index?: number;
};

export type PhotoDisplayLabel = {
  title: string;
  eyebrow: string;
  detail: string;
  filename: string;
};

function clean(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function fileExtension(filename: string) {
  return filename.split(".").pop()?.toUpperCase() || "IMAGE";
}

function frameNumber(filename: string) {
  const nameWithoutExtension = filename.replace(/\.[^.]+$/, "");
  const matches = [...nameWithoutExtension.matchAll(/\d+/g)];
  const lastNumber = matches.at(-1)?.[0];

  return lastNumber ? lastNumber.padStart(3, "0") : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function photoSpecLine(photo: PhotoDisplaySource) {
  const camera = clean(photo.camera_model);
  const lens = clean(photo.lens_model);
  const exposure = [
    clean(photo.focal_length),
    clean(photo.aperture),
    clean(photo.shutter_speed),
    clean(photo.iso)
  ].filter(Boolean);
  const parts = [camera, lens, exposure.join(" · ") || null].filter(Boolean);

  return parts.length ? parts.join(" · ") : null;
}

export function photoDisplayLabel(
  photo: PhotoDisplaySource,
  context: PhotoDisplayContext = {}
): PhotoDisplayLabel {
  const title =
    clean(photo.display_title) ??
    clean(photo.caption) ??
    (frameNumber(photo.filename)
      ? `Frame ${frameNumber(photo.filename)}`
      : context.index !== undefined
        ? `Frame ${String(context.index + 1).padStart(3, "0")}`
        : "Delivered frame");
  const specLine = photoSpecLine(photo);
  const dateOrPlace = clean(photo.location) ?? formatDate(photo.captured_at) ?? formatDate(context.eventDate);
  const fallbackEyebrow = `Final delivery ${fileExtension(photo.filename)}`;
  const fallbackDetail = dateOrPlace ?? clean(context.albumTitle) ?? "Ready to view and download";

  return {
    title,
    eyebrow: specLine ?? fallbackEyebrow,
    detail: specLine ? (dateOrPlace ?? fallbackDetail) : fallbackDetail,
    filename: photo.filename
  };
}
