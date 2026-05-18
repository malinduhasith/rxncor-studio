import { createHash } from "crypto";

export function albumAccessCookieName(albumId: string) {
  return `rxncor_album_${albumId}`;
}

export function albumClientEmailCookieName(albumId: string) {
  return `rxncor_album_email_${albumId}`;
}

export function createAlbumAccessToken(albumId: string, accessSecret: string) {
  return createHash("sha256")
    .update(`album:${albumId}:${accessSecret}`)
    .digest("hex");
}

export function createEmailAccessToken(albumId: string, email: string) {
  return createAlbumAccessToken(albumId, `email:${email.toLowerCase().trim()}`);
}

export function hasAlbumAccess(
  albumId: string,
  passwordHash: string | null,
  cookieValue: string | undefined
) {
  if (!passwordHash || !cookieValue) {
    return false;
  }

  return cookieValue === createAlbumAccessToken(albumId, passwordHash);
}
