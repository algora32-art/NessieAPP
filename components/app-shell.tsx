import { getSessionAndProfile } from "@/lib/auth";
import { ClientShell } from "@/components/client-shell";

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = await getSessionAndProfile();
  // If profile isn't found, ClientShell still needs something to render.
  const safeProfile = profile ?? { id: "", name: "Usuario", role: "technician", avatar_url: null };
  return (
    <ClientShell
      profile={{
        id: safeProfile.id,
        name: safeProfile.name || "Usuario",
        role: safeProfile.role,
        avatar_url: (safeProfile as any).avatar_url ?? null,
      }}
    >
      {children}
    </ClientShell>
  );
}
