"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import Link from "next/link";

type StatusRow = {
  key: string
  label: string
  sort_order: number
  color: string
  is_terminal: boolean
}

type Status = {
  key: string
  label: string
  sort_order: number
  color: string
  is_terminal: boolean
}

type WorkOrder = {
  id: string;
  status: Status;
  client_id: string;
  client_name: string;
  phone: string;
  address: string;
  service: string | null;
  description?: string | null;
  scheduled_start: string | null;
  estimated_minutes?: number | null;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  tags?: any;
  created_at: string;
};

type Tech = { id: string; name: string };

export default function Kanban() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [meRole, setMeRole] = useState<"admin"|"technician">("technician");
  const [loading, setLoading] = useState(true);
  const [compact, setCompact] = useState<boolean>(true);

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [service, setService] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState<string>("");
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("");

  function waLink(p: string) {
    const clean = (p || "").replace(/[^0-9]/g, "");
    return `https://wa.me/${clean}`;
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("work_orders_view").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as any);
    setLoading(false);
  }

  async function loadStatuses() {
    const { data } = await supabase
      .from("work_order_statuses")
      .select("key,label,sort_order,color,is_terminal")
      .order("sort_order", { ascending: true });
    setStatuses(((data ?? []) as any) as StatusRow[]);
  }

  async function loadMeAndTechs() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    setMeRole((prof?.role ?? "technician") as any);

    const { data: t } = await supabase
      .from("profiles")
      .select("id,name")
      .eq("role", "technician")
      .eq("active", true)
      .order("name", { ascending: true });
    setTechs((t ?? []) as any);
  }

  useEffect(() => {
    load();
    loadStatuses();
    loadMeAndTechs();
    const ch = supabase
      .channel("wo-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createOS() {
    // Normalize inputs to prevent accidental overwrites via (phone) uniqueness.
    // Example: if the user types spaces, dashes, or leaves whitespace-only values,
    // Postgres sees the same phone string and the ON CONFLICT branch updates the same client.
    const nClientName = clientName.trim();
    const nPhone = phone.replace(/\D/g, "");
    const nAddress = address.trim();
    const nService = service.trim();

    const scheduled_start = scheduledLocal ? new Date(scheduledLocal).toISOString() : null;
    const { error } = await supabase.rpc("create_work_order_with_client", {
      p_client_name: nClientName,
      p_phone: nPhone,
      p_address: nAddress,
      p_service: nService || null,
      p_description: null,
      p_scheduled_start: scheduled_start,
      p_estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      p_assigned_to: meRole === "admin" ? (assignedTo || null) : null
    });
    if (error) alert(error.message);
    setClientName(""); setPhone(""); setAddress(""); setService("");
    setScheduledLocal(""); setEstimatedMinutes(""); setAssignedTo("");
    await load();
  }

  async function move(id: string, status: Status) {
    const { error } = await supabase.from("work_orders").update({ status }).eq("id", id);
    if (error) alert(error.message);
  }

  const byStatus = (s: Status) => items.filter(i => i.status === s);

  function timeLocal(iso: string) {
    try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="font-semibold">Nueva OS</div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div><Label>Cliente</Label><Input value={clientName} onChange={(e)=>setClientName(e.target.value)} /></div>
          <div><Label>Teléfono</Label><Input value={phone} onChange={(e)=>setPhone(e.target.value)} /></div>
          <div><Label>Dirección</Label><Input value={address} onChange={(e)=>setAddress(e.target.value)} /></div>
          <div><Label>Servicio</Label><Input value={service} onChange={(e)=>setService(e.target.value)} /></div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label>Cita</Label>
            <Input type="datetime-local" value={scheduledLocal} onChange={(e)=>setScheduledLocal(e.target.value)} />
          </div>
          <div>
            <Label>Duración (min)</Label>
            <Input type="number" value={estimatedMinutes} onChange={(e)=>setEstimatedMinutes(e.target.value)} />
          </div>
          {meRole === "admin" ? (
            <div className="md:col-span-2">
              <Label>Asignar a técnico</Label>
              <Select value={assignedTo} onChange={(e)=>setAssignedTo(e.target.value)}>
                <option value="">(sin asignar)</option>
                {techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
          ) : (
            <div className="md:col-span-2">
              <div className="text-xs text-[rgb(var(--muted))] mt-6">* La asignación la realiza un administrador.</div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <Button onClick={createOS} disabled={!clientName || !phone || !address}>Crear OS</Button>
        </div>
      </Card>

      {loading ? <div className="text-sm text-[rgb(var(--muted))]">Cargando...</div> : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-[rgb(var(--muted))]">Arrastra (próximo) / cambia el estado desde el selector.</div>
            <Button variant="ghost" onClick={() => setCompact((v) => !v)}>
              {compact ? "Modo completo" : "Modo compacto"}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-6">
            {(statuses.length ? statuses : [{ key: "Nuevo", label: "Nuevo", sort_order: 0, color: "#94a3b8", is_terminal: false }] as StatusRow[]).map((st: StatusRow) => (

                <div className="mb-2 text-sm font-semibold flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                  {st.label}
                </div>
                <div className="space-y-3">
                  {(statuses.length ? statuses : ([{
  key: "Nuevo",
  label: "Nuevo",
  sort_order: 0,
  color: "#94a3b8",
  is_terminal: false,
}] as StatusRow[])).map((st: StatusRow) => (
                    <Card key={wo.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/work-orders/${wo.id}`} className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{wo.client_name}</div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="text-xs text-[rgb(var(--muted))] truncate">{wo.service ?? "—"}</div>
                            <div className="text-xs text-[rgb(var(--muted))]">{wo.scheduled_start ? timeLocal(wo.scheduled_start) : "—"}</div>
                          </div>
                          {!compact ? (
                            <>
                              <div className="mt-1 text-xs truncate">{wo.address}</div>
                              <div className="mt-1 text-xs font-medium">{wo.phone}</div>
                              {wo.assigned_to_name ? (
                                <div className="mt-2 text-[11px] rounded-full border px-2 py-0.5 inline-block">Téc: {wo.assigned_to_name}</div>
                              ) : null}
                              {Array.isArray(wo.tags) && wo.tags.length ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {wo.tags.slice(0, 4).map((t: any) => (
                                    <span key={t.id} className="text-[11px] rounded-full border px-2 py-0.5" style={{ borderColor: t.color, color: t.color }}>
                                      {t.name}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="mt-1 text-xs font-medium">{wo.phone}</div>
                          )}
                      </Link>
                      <a className="text-xs underline" href={waLink(wo.phone)} target="_blank" rel="noreferrer">WhatsApp</a>
                    </div>
                    <div className="mt-3">
                        {/* ✅ Always show context while changing status */}
                        <div className="mb-1 text-[11px] text-[rgb(var(--muted))] truncate">
                          {wo.client_name} · {wo.service ?? "(sin servicio)"}
                        </div>
                        <Select value={wo.status} onChange={(e)=>move(wo.id, e.target.value as any)}>
                          {(statuses.length ? statuses : [{ key: "Nuevo", label: "Nuevo" }] as any).map((s2: any) => (
                            <option key={s2.key} value={s2.key}>{s2.label}</option>
                          ))}
                        </Select>
                    </div>
                  </Card>
                  ))}
                  {!byStatus(st.key).length && <div className="text-xs text-[rgb(var(--muted))]">Sin OS</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
