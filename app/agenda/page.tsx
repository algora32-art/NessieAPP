import AppShell from "@/components/app-shell";
import { getSessionAndProfile } from "@/lib/auth";
import UIAgenda from "./ui-agenda";

export default async function Page() {
  const { profile } = await getSessionAndProfile();
  return (
    <AppShell>
      <UIAgenda role={(profile?.role as any) ?? "technician"} />
    </AppShell>
  );
}
