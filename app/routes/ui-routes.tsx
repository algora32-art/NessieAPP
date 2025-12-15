"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button, Card } from "@/components/ui";

function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Av = {
  id: string;
  client_name: string;
  phone: string;
  address?: string;
  service: string | null;
  status: string;
  scheduled_start: string | null;
  estimated_minutes?: number | null;
  tags?: any;
};

type RouteItem = {
  id: string;
  route_number: number;
  work_order_id: string;
  done: boolean;
  work_order: any;
};

function timeLocal(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(iso);
  }
}

function waLink(p?: string | null) {
  const clean = String(p || "").replace(/[^0-9]/g, "");
  return `https://wa.me/${clean}`;
}

export default function UI() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [date, setDate] = useState<string>(() => todayLocalISO());
  const [available, setAvailable] = useState<Av[]>([]);
  const [r1, setR1] = useState<RouteItem[]>([]);
  const [r2, setR2] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    const { data: av, error: e1 } = await supabase.rpc("work_orders_for_date", { p_date: date });
    if (e1) alert(e1.message);
    setAvailable((av ?? []) as any);

    const { data: ri, error: e2 } = await supabase.rpc("route_items_for_date", { p_date: date });
    if (e2) alert(e2.message);
    const items = ((ri ?? []) as any) as RouteItem[];
    setR1(items.filter((x) => x.route_number === 1 && !x.done));
    setR2(items.filter((x) => x.route_number === 2 && !x.done));

    setLoading(false);
  }

  useEffect(() => {
    load();

    // ✅ Realtime refresh: routes and available list update when OS/tasks/routes change
    const ch = supabase
      .channel(`routes-${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "route_items" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "routes" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function add(workOrderId: string, routeNumber: 1 | 2) {
    // ✅ DB decides technician_id:
    // - If admin adds, it will assign to the WO.assigned_to (if set), otherwise to the caller.
    // - If technician adds, it assigns to themselves.
    const { error } = await supabase.rpc("add_work_order_to_route", {
      p_date: date,
      p_route_number: routeNumber,
      p_work_order_id: workOrderId,
    });
    if (error) alert(error.message);
    await load();
  }

  async function finish(itemId: string) {
    const { error } = await supabase
      .from("route_items")
      .update({ done: true, finished_at: new Date().toISOString() })
      .eq("id", itemId);
    if (error) alert(error.message);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm text-[rgb(var(--muted))]">Día:</div>
        <input
          className="rounded-lg border bg-transparent px-3 py-2 text-sm"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button variant="ghost" onClick={load}>
          Refrescar
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-[rgb(var(--muted))]">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <div className="font-semibold">OS del día</div>
            <div className="mt-3 space-y-2">
              {available.map((wo) => (
                <div key={wo.id} className="rounded-lg border p-3">
                  <div className="font-semibold text-sm">{wo.client_name}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <div className="text-xs text-[rgb(var(--muted))] truncate">{wo.service ?? "—"}</div>
                    <div className="text-xs text-[rgb(var(--muted))]">{timeLocal(wo.scheduled_start)}</div>
                  </div>
                  {wo.address ? <div className="mt-1 text-xs truncate">{wo.address}</div> : null}
                  <div className="text-xs">{wo.phone}</div>

                  {Array.isArray(wo.tags) && wo.tags.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {wo.tags.slice(0, 4).map((t: any) => (
                        <span
                          key={t.id}
                          className="text-[11px] rounded-full border px-2 py-0.5"
                          style={{ borderColor: t.color, color: t.color }}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-2 flex items-center gap-2">
                    <Button variant="ghost" onClick={() => add(wo.id, 1)}>
                      Ruta 1
                    </Button>
                    <Button variant="ghost" onClick={() => add(wo.id, 2)}>
                      Ruta 2
                    </Button>
                    <a className="text-xs underline" href={waLink(wo.phone)} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                  </div>
                </div>
              ))}
              {!available.length && <div className="text-xs text-[rgb(var(--muted))]">No hay OS agendadas.</div>}
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-semibold">Ruta 1</div>
            <div className="mt-3 space-y-2">
              {r1.map((it) => (
                <div key={it.id} className="rounded-lg border p-3">
                  <div className="font-semibold text-sm">{it.work_order.client_name}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <div className="text-xs text-[rgb(var(--muted))] truncate">{it.work_order.service ?? "—"}</div>
                    <div className="text-xs text-[rgb(var(--muted))]">{timeLocal(it.work_order.scheduled_start)}</div>
                  </div>
                  {it.work_order.address ? <div className="mt-1 text-xs truncate">{it.work_order.address}</div> : null}
                  <div className="text-xs">{it.work_order.phone}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <a className="text-xs underline" href={waLink(it.work_order.phone)} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                    <Button onClick={() => finish(it.id)}>Finalizar</Button>
                  </div>
                </div>
              ))}
              {!r1.length && <div className="text-xs text-[rgb(var(--muted))]">Sin OS en ruta.</div>}
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-semibold">Ruta 2</div>
            <div className="mt-3 space-y-2">
              {r2.map((it) => (
                <div key={it.id} className="rounded-lg border p-3">
                  <div className="font-semibold text-sm">{it.work_order.client_name}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <div className="text-xs text-[rgb(var(--muted))] truncate">{it.work_order.service ?? "—"}</div>
                    <div className="text-xs text-[rgb(var(--muted))]">{timeLocal(it.work_order.scheduled_start)}</div>
                  </div>
                  {it.work_order.address ? <div className="mt-1 text-xs truncate">{it.work_order.address}</div> : null}
                  <div className="text-xs">{it.work_order.phone}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <a className="text-xs underline" href={waLink(it.work_order.phone)} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                    <Button onClick={() => finish(it.id)}>Finalizar</Button>
                  </div>
                </div>
              ))}
              {!r2.length && <div className="text-xs text-[rgb(var(--muted))]">Sin OS en ruta.</div>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
