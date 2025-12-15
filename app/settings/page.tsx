import AppShell from "@/components/app-shell";
import UI from "./ui-settings";
import { getSessionAndProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  const { profile } = await getSessionAndProfile();
  if (profile?.role !== "admin") redirect("/routes");
  return <AppShell><h1 className="text-2xl font-semibold">Configuración</h1><p className="mt-1 text-sm text-[rgb(var(--muted))]">Perfil y etiquetas.</p><div className="mt-6"><UI /></div></AppShell>;
}
