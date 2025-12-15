import { supabaseServer } from "./supabase/server";
export async function getSessionAndProfile() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,name,role,avatar_url,active")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: (profile as any) ?? null };
}
