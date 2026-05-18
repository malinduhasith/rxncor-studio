import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/config/server-env";

export function createSupabaseAdminClient() {
  const supabaseEnv = getSupabaseEnv();

  if (!supabaseEnv.serviceRoleKey) {
    throw new Error("Missing Supabase service role or secret key.");
  }

  return createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}
