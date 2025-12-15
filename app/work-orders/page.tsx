import AppShell from "@/components/app-shell";
import Kanban from "./ui-kanban";
import { getSessionAndProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  const { profile } = await getSessionAndProfile();
  if (profile?.role !== "admin") redirect("/routes");
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Órdenes de Servicio</h1>
      <p className="mt-1 text-sm text-[rgb(var(--muted))]">Kanban (clic para abrir OS y editar).</p>
      <div className="mt-6"><Kanban /></div>
    </AppShell>
  );
}
