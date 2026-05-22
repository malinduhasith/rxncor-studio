import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmailAllowed } from "@/lib/admin-auth";

export async function getVerifiedAdminApiClient() {
  const viewerSupabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await viewerSupabase.auth.getUser();

  if (!user) {
    return null;
  }

  if (!isAdminEmailAllowed(user.email)) {
    return null;
  }

  return createSupabaseAdminClient();
}
