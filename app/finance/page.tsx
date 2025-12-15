import AppShell from "@/components/app-shell";
import { getSessionAndProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import FinanceUI from "./ui-finance";

export default async function Page() {
  const { profile } = await getSessionAndProfile();
  if (profile?.role !== "admin") redirect("/routes");
  return (
    <AppShell>
      <FinanceUI />
    </AppShell>
  );
}
