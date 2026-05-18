import type { SupabaseClient } from "@supabase/supabase-js";
import {
  albumAccessCookieName,
  albumClientEmailCookieName,
  clientSessionCookieName,
  createAlbumAccessToken,
  createClientSessionToken,
  createEmailAccessToken,
  parseClientSessionCookie
} from "@/lib/gallery-access";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export type AccessAlbum = {
  id: string;
  is_password_protected: boolean;
  password_hash: string | null;
  requires_email?: boolean;
  allow_client_password_access?: boolean;
};

type AccessClient = {
  id: string;
  email: string | null;
  password_hash?: string | null;
};

export type GalleryAccess = {
  canAccess: boolean;
  clientEmail: string | null;
};

export function albumRequiresUnlock(album: AccessAlbum) {
  return Boolean(album.is_password_protected || album.requires_email);
}

async function assignedClientByEmail(
  supabase: SupabaseClient,
  albumId: string,
  email: string
) {
  const { data: assignments } = await supabase
    .from("album_clients")
    .select("client_id")
    .eq("album_id", albumId);
  const assignedClientIds = (assignments ?? []).map((row) => row.client_id);

  if (!assignedClientIds.length) {
    return null;
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, email, password_hash")
    .in("id", assignedClientIds)
    .ilike("email", email)
    .maybeSingle();

  return client as AccessClient | null;
}

async function assignedClientBySession(
  supabase: SupabaseClient,
  albumId: string,
  cookieStore: CookieReader
) {
  const session = parseClientSessionCookie(
    cookieStore.get(clientSessionCookieName())?.value
  );

  if (!session) {
    return null;
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, email, password_hash")
    .eq("id", session.clientId)
    .maybeSingle();
  const sessionClient = client as AccessClient | null;

  if (
    !sessionClient?.password_hash ||
    session.token !== createClientSessionToken(sessionClient.id, sessionClient.password_hash)
  ) {
    return null;
  }

  const { data: assignment } = await supabase
    .from("album_clients")
    .select("album_id")
    .eq("album_id", albumId)
    .eq("client_id", sessionClient.id)
    .maybeSingle();

  return assignment ? sessionClient : null;
}

export async function getGalleryAccessForCookies({
  supabase,
  album,
  cookieStore,
  adminBypass = false
}: {
  supabase: SupabaseClient;
  album: AccessAlbum;
  cookieStore: CookieReader;
  adminBypass?: boolean;
}): Promise<GalleryAccess> {
  if (adminBypass || !albumRequiresUnlock(album)) {
    return { canAccess: true, clientEmail: null };
  }

  const clientEmail =
    cookieStore.get(albumClientEmailCookieName(album.id))?.value?.toLowerCase() ??
    null;
  const accessCookie = cookieStore.get(albumAccessCookieName(album.id))?.value;

  if (accessCookie) {
    const possibleTokens = [
      album.password_hash ? createAlbumAccessToken(album.id, album.password_hash) : null,
      clientEmail && album.requires_email
        ? createEmailAccessToken(album.id, clientEmail)
        : null
    ];

    if (clientEmail && album.allow_client_password_access !== false) {
      const assignedClient = await assignedClientByEmail(
        supabase,
        album.id,
        clientEmail
      );

      if (assignedClient?.password_hash) {
        possibleTokens.push(
          createAlbumAccessToken(
            album.id,
            `client:${assignedClient.id}:${assignedClient.password_hash}`
          )
        );
      }
    }

    if (possibleTokens.includes(accessCookie)) {
      return { canAccess: true, clientEmail };
    }
  }

  if (album.allow_client_password_access !== false) {
    const sessionClient = await assignedClientBySession(supabase, album.id, cookieStore);

    if (sessionClient) {
      return { canAccess: true, clientEmail: sessionClient.email };
    }
  }

  return { canAccess: false, clientEmail };
}
