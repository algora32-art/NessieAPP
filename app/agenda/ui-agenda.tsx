"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button, Card } from "@/components/ui";

type Av = {
  id: string;
  client_name: string;
  phone: string;
  address?: string | null;
  service: string | null;
  description?: string | null;
  status: string;
  scheduled_start: string | null;
  estimated_minutes?: number | null;
};

function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeLocal(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function waLink(p: string) {
  const clean = (p || "").replace(/[^0-9]/g, "");
  return `https://wa.me/${clean}`;
}

function isWeekend(yyyyMmDd: string) {
  const d = new Date(`${yyyyMmDd}T12:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function addDays(yyyyMmDd: string, delta: number) {
  const d = new Date(`${yyyyMmDd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(yyyyMmDd: string) {
  // Use midday to avoid DST edge cases.
  const d = new Date(`${yyyyMmDd}T12:00:00`);
  const dow = d.getDay(); // 0..6 (Sun..Sat)
  const diff = (dow + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekDaysMonFri(yyyyMmDd: string) {
  const mon = startOfWeekMonday(yyyyMmDd);
  return [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
}

export default function UIAgenda({ role }: { role: "admin" | "technician" }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [date, setDate] = useState<string>(() => todayLocalISO());
  const [items, setItems] = useState<Av[]>([]);
  const [loading, setLoading] = useState(true);

  // Force Mon–Fri. If user picks weekend, jump to Monday of that same week.
  useEffect(() => {
    if (!date) return;
    if (isWeekend(date)) setDate(startOfWeekMonday(date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("work_orders_for_date", { p_date: date });
    if (error) alert(error.message);
    setItems((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <div className="flex-1" />
        <Button
          variant="ghost"
          onClick={() => setDate(addDays(startOfWeekMonday(date), -7))}
          title="Semana anterior"
        >
          ←
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {weekDaysMonFri(date).map((d, idx) => {
            const label = ["Lun", "Mar", "Mié", "Jue", "Vie"][idx];
            const active = d === date;
            return (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={
                  "rounded-lg border px-3 py-2 text-sm transition " +
                  (active ? "bg-white/10" : "hover:bg-white/5")
                }
                title={d}
              >
                <span className="font-medium">{label}</span>
                <span className="ml-2 text-xs text-[rgb(var(--muted))]">{d.slice(8, 10)}</span>
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          onClick={() => setDate(addDays(startOfWeekMonday(date), 7))}
          title="Semana siguiente"
        >
          →
        </Button>

        <div className="hidden sm:flex items-center gap-2">
          <div className="text-sm text-[rgb(var(--muted))]">Ir a:</div>
          <input
            className="rounded-lg border bg-transparent px-3 py-2 text-sm"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <Button variant="ghost" onClick={load}>Refrescar</Button>
      </div>

      <Card className="p-4">
        <div className="text-sm text-[rgb(var(--muted))]">
          {role === "admin" ? "Todas las citas (según permisos/RLS)." : "Tus citas asignadas / creadas."}
        </div>

        <div className="mt-3 max-h-[65vh] overflow-y-auto pr-1 space-y-2">
          {loading ? (
            <div className="text-sm text-[rgb(var(--muted))]">Cargando...</div>
          ) : items.length ? (
            items.map((wo) => (
              <div key={wo.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{wo.client_name}</div>
                  <div className="text-xs text-[rgb(var(--muted))]">
                    {wo.scheduled_start ? timeLocal(wo.scheduled_start) : "—"}
                  </div>
                </div>
                <div className="mt-1 text-xs text-[rgb(var(--muted))]">{wo.service ?? "—"}</div>
                {wo.address ? <div className="mt-1 text-xs">{wo.address}</div> : null}
                {wo.description ? (
                  <div className="mt-1 text-xs text-[rgb(var(--muted))] whitespace-pre-wrap">{wo.description}</div>
                ) : null}
                <div className="mt-1 text-xs">{wo.phone}</div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xs rounded-full border px-2 py-1">{wo.status}</span>
                  {typeof wo.estimated_minutes === "number" ? (
                    <span className="text-xs rounded-full border px-2 py-1 text-[rgb(var(--muted))]">
                      {wo.estimated_minutes} min
                    </span>
                  ) : null}
                  <a className="text-xs underline" href={waLink(wo.phone)} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                  <a className="text-xs underline" href={`/work-orders/${wo.id}`}>
                    Abrir OS
                  </a>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-[rgb(var(--muted))]">No hay citas en este día.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
