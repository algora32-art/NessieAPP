"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { Divider } from "./ui";
import { LogoutButton } from "./logout-button";
import { NotificationsRail } from "./notifications-rail";

// Roles come from DB (`profiles.role`).
type Role = "admin" | "technician";
type Profile = { id: string; name: string; role: Role; avatar_url?: string | null };

type NavItem = { href: string; label: string; roles?: Role[] };

const NAV: NavItem[] = [
  { href: "/", label: "Panel", roles: ["admin"] },
  { href: "/work-orders", label: "Órdenes de Servicio", roles: ["admin"] },
  { href: "/clients", label: "Clientes", roles: ["admin"] },
  { href: "/routes", label: "Rutas", roles: ["admin","technician"] },
  { href: "/agenda", label: "Agenda", roles: ["admin"] },
  { href: "/finance", label: "Finanzas", roles: ["admin"] },
  { href: "/tasks", label: "Tareas", roles: ["admin","technician"] },
  { href: "/settings", label: "Configuración", roles: ["admin","technician"] },
  { href: "/users", label: "Usuarios", roles: ["admin"] },
];

export function ClientShell({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const [notifOpen, setNotifOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("nessie:notifOpen");
    if (saved !== null) setNotifOpen(saved === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("nessie:notifOpen", notifOpen ? "1" : "0");
  }, [notifOpen]);

  const filtered = useMemo(
    () => NAV.filter(i => !i.roles || i.roles.includes(profile.role)),
    [profile.role]
  );

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-[rgb(var(--card))] p-4 flex flex-col">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-xl bg-[rgb(var(--bg))] border">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">Nessie 2026</div>
            <div className="text-xs text-[rgb(var(--muted))] truncate">{profile.name} · {profile.role}</div>
          </div>
        </div>

        <Divider />

        <nav className="flex-1 space-y-1">
          {filtered.map((i) => (
            <Link key={i.href} href={i.href} className="block rounded-lg px-3 py-2 text-sm hover:bg-[rgb(var(--bg))]">
              {i.label}
            </Link>
          ))}
        </nav>

        <Divider />

        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <button
            className="rounded-lg px-3 py-2 text-sm border hover:bg-[rgb(var(--bg))]"
            onClick={() => setNotifOpen(v => !v)}
            type="button"
            title="Ocultar/mostrar notificaciones"
          >
            {notifOpen ? "Ocultar notifs" : "Mostrar notifs"}
          </button>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 flex">
        <div className="flex-1 p-6">{children}</div>
        {notifOpen ? <NotificationsRail /> : null}
      </main>
    </div>
  );
}
