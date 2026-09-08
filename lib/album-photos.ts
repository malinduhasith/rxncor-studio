import type { SupabaseClient } from "@supabase/supabase-js";

// Supabase returns at most one page by default. Selection must include the
// complete album, including photographs not yet mounted in the mobile grid.
export async function readAlbumPhotos<T>(supabase: SupabaseClient, albumId: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase.from("photos").select(columns).eq("album_id", albumId)
      .order("uploaded_at", { ascending: true }).order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (result.error) throw new Error("The complete photo list could not be loaded.");
    rows.push(...(result.data ?? []) as T[]);
    if ((result.data?.length ?? 0) < pageSize) return rows;
  }
}
