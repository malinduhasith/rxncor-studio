import { createHash } from "crypto";

export function albumAccessCookieName(albumId: string) {
  return `rxncor_album_${albumId}`;
}

export function createAlbumAccessToken(albumId: string, passwordHash: string) {
  return createHash("sha256")
    .update(`album:${albumId}:${passwordHash}`)
    .digest("hex");
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
