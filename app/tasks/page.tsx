import AppShell from "@/components/app-shell";
import UI from "./ui-tasks";
export default async function Page() {
  return <AppShell><h1 className="text-2xl font-semibold">Tareas</h1><p className="mt-1 text-sm text-[rgb(var(--muted))]">Pendientes.</p><div className="mt-6"><UI /></div></AppShell>;
}
