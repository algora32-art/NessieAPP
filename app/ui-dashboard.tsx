"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Card } from "@/components/ui";

type Role = "admin" | "technician";

export default function Dashboard({ role }: { role: Role }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<{ label: string; value: any }[]>([]);

  async function load() {
    setLoading(true);
    if (role === "admin") {
      const [a, b, c, d] = await Promise.all([
        supabase.from("work_orders").select("id", { count: "exact", head: true }).neq("status", "Finalizado"),
        supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("status", "Servicio agendado"),
        supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("status", "Pendiente por cerrar"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("done", false),
      ]);
      setCards([
        { label: "OS activas", value: a.count ?? 0 },
        { label: "Servicio agendado", value: b.count ?? 0 },
        { label: "Pendiente por cerrar", value: c.count ?? 0 },
        { label: "Tareas pendientes", value: d.count ?? 0 },
      ]);
    } else {
      // Técnico: muestra lo que le afecta hoy
      const today = new Date().toLocaleDateString();
      const { data: ri } = await supabase.rpc("route_items_for_date", { p_date: new Date().toISOString().slice(0, 10) });
      const items = (ri ?? []) as any[];
      const r1 = items.filter((x) => x.route_number === 1 && !x.done).length;
      const r2 = items.filter((x) => x.route_number === 2 && !x.done).length;
      const { count: tCount } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("done", false);
      setCards([
        { label: "Hoy", value: today },
        { label: "Ruta 1", value: r1 },
        { label: "Ruta 2", value: r2 },
        { label: "Tareas pendientes", value: tCount ?? 0 },
      ]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();

    // ✅ Realtime: si agregas OS / cambias estado / creas o completas tarea, el panel se actualiza
    const ch = supabase
      .channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "route_items" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {loading
        ? Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-4 w-24 rounded bg-white/5" />
              <div className="mt-4 h-8 w-16 rounded bg-white/10" />
            </Card>
          ))
        : cards.map((c) => (
            <Card key={c.label} className="p-4">
              <div className="text-xs text-[rgb(var(--muted))]">{c.label}</div>
              <div className="mt-2 text-3xl font-semibold">{c.value}</div>
            </Card>
          ))}
    </div>
  );
}
