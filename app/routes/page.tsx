import AppShell from "@/components/app-shell";
import UI from "./ui-routes";
export default async function Page() {
  return <AppShell><h1 className="text-2xl font-semibold">Rutas</h1><p className="mt-1 text-sm text-[rgb(var(--muted))]">Solo ves tus rutas si eres técnico.</p><div className="mt-6"><UI /></div></AppShell>;
}
