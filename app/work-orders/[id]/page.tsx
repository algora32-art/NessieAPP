import AppShell from "@/components/app-shell";
import { getSessionAndProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import WorkOrderDetail from "./ui-detail";

export default async function Page({ params }: { params: { id: string } }) {
  const { profile } = await getSessionAndProfile();
  if (!profile) redirect("/login");
  return (
    <AppShell>
      <WorkOrderDetail id={params.id} role={profile.role} />
    </AppShell>
  );
}
