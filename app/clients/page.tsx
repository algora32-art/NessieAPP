import AppShell from "@/components/app-shell";
import UI from "./ui-clients";
import { getSessionAndProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  const { profile } = await getSessionAndProfile();
  if (profile?.role !== "admin") redirect("/routes");
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Clientes</h1>
      <p className="mt-1 text-sm text-[rgb(var(--muted))]">Listado automático.</p>
      <div className="mt-6"><UI /></div>
    </AppShell>
  );
}
