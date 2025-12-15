"use client";
import { Button } from "./ui";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LogoutButton() {
  const supabase = supabaseBrowser();
  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }
  return <Button variant="ghost" onClick={logout}>Cerrar sesión</Button>;
}
