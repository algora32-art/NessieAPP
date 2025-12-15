import AppShell from "@/components/app-shell";
import { Card } from "@/components/ui";
import { getSessionAndProfile } from "@/lib/auth";
import Dashboard from "./ui-dashboard";

export default async function Page() {
  const { profile } = await getSessionAndProfile();

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Panel</h1>
      <p className="mt-1 text-sm text-[rgb(var(--muted))]">Vista general.</p>

      <Dashboard role={(profile?.role ?? "technician") as any} />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><div className="font-semibold">Balance (MVP)</div><p className="mt-2 text-sm text-[rgb(var(--muted))]">Ingresos vs egresos.</p></Card>
        <Card><div className="font-semibold">Actividad</div><p className="mt-2 text-sm text-[rgb(var(--muted))]">Ver notificaciones a la derecha.</p></Card>
      </div>
    </AppShell>
  );
}
