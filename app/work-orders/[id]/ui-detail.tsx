"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button, Card, Input, Label, Select } from "@/components/ui";

type StatusRow = { key: string; label: string; sort_order: number; color: string; is_terminal: boolean };
type Tag = { id: string; name: string; color: string };
type WO = {
  id: string;
  status: string;
  client_id: string;
  client_name: string;
  phone: string;
  address: string;
  service: string | null;
  description: string | null;
  scheduled_start: string | null;
  estimated_minutes: number | null;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  tags: Tag[];
};

type Tech = { id: string; name: string };

function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function WorkOrderDetail({ id, role }: { id: string; role: "admin" | "technician" }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [wo, setWo] = useState<WO | null>(null);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#34d399");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("work_orders_view").select("*").eq("id", id).maybeSingle();
    if (error) alert(error.message);
    if (!data) {
      setWo(null);
      setLoading(false);
      return;
    }
    setWo({ ...(data as any), tags: ((data as any).tags ?? []) as Tag[] });
    setLoading(false);
  }

  async function loadStatuses() {
    const { data } = await supabase
      .from("work_order_statuses")
      .select("key,label,sort_order,color,is_terminal")
      .order("sort_order", { ascending: true });
    setStatuses(((data ?? []) as any) as StatusRow[]);
  }

  async function loadTechs() {
    if (role !== "admin") return;
    const { data } = await supabase.from("profiles").select("id,name").eq("role", "technician").eq("active", true).order("name");
    setTechs((data ?? []) as any);
  }

  async function loadTags() {
    const { data } = await supabase.from("tags").select("id,name,color").order("name");
    setAllTags((data ?? []) as any);
  }

  useEffect(() => {
    load();
    loadStatuses();
    loadTechs();
    loadTags();
    const ch = supabase
      .channel("wo-one")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "work_orders", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveCore(next: Partial<WO>) {
    if (!wo) return;
    const patch: any = {};
    if ("status" in next) patch.status = next.status;
    if ("service" in next) patch.service = next.service;
    if ("description" in next) patch.description = next.description;
    if ("scheduled_start" in next) patch.scheduled_start = next.scheduled_start;
    if ("estimated_minutes" in next) patch.estimated_minutes = next.estimated_minutes;
    if (role === "admin" && "assigned_to" in next) patch.assigned_to = next.assigned_to;
    const { error } = await supabase.from("work_orders").update(patch).eq("id", wo.id);
    if (error) alert(error.message);
    await load();
  }

  async function saveClient(next: { client_name: string; phone: string; address: string }) {
    if (!wo) return;
    const { error } = await supabase.rpc("update_work_order_and_client", {
      p_work_order_id: wo.id,
      p_client_name: next.client_name,
      p_phone: next.phone,
      p_address: next.address,
      p_service: wo.service,
      p_description: wo.description,
      p_status: wo.status,
      p_scheduled_start: wo.scheduled_start,
      p_estimated_minutes: wo.estimated_minutes,
      p_assigned_to: wo.assigned_to,
    });
    if (error) alert(error.message);
    await load();
  }

  async function toggleTag(tagId: string) {
    if (!wo) return;
    const exists = wo.tags?.some((t) => t.id === tagId);
    if (exists) {
      const { error } = await supabase.from("work_order_tags").delete().eq("work_order_id", wo.id).eq("tag_id", tagId);
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.from("work_order_tags").insert({ work_order_id: wo.id, tag_id: tagId });
      if (error) alert(error.message);
    }
    await load();
  }

  async function createTag() {
    const name = newTagName.trim();
    if (!name) return;
    const { error } = await supabase.from("tags").insert({ name, color: newTagColor });
    if (error) alert(error.message);
    setNewTagName("");
    await loadTags();
  }

  if (loading) return <div className="text-sm text-[rgb(var(--muted))]">Cargando...</div>;
  if (!wo) return <div className="text-sm text-[rgb(var(--muted))]">No se encontró la OS o no tienes permisos.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">OS</h1>
        <div className="text-xs text-[rgb(var(--muted))]">ID: {wo.id}</div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="font-semibold">Estado / Agenda</div>
          <div className="mt-1 text-xs text-[rgb(var(--muted))] truncate">
            {wo.client_name} · {wo.service ?? "(sin servicio)"}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Estado</Label>
              <Select value={wo.status} onChange={(e) => saveCore({ status: e.target.value })}>
                {(statuses.length ? statuses : [{ key: "Nuevo", label: "Nuevo" }] as any).map((s: any) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Cita</Label>
              <Input
                type="datetime-local"
                value={toDatetimeLocalValue(wo.scheduled_start)}
                onChange={(e) => saveCore({ scheduled_start: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
            <div>
              <Label>Duración (min)</Label>
              <Input
                type="number"
                value={wo.estimated_minutes ?? ""}
                onChange={(e) => saveCore({ estimated_minutes: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            {role === "admin" ? (
              <div>
                <Label>Técnico</Label>
                <Select value={wo.assigned_to ?? ""} onChange={(e) => saveCore({ assigned_to: e.target.value || null })}>
                  <option value="">(sin asignar)</option>
                  {techs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="md:col-span-1">
                <div className="mt-6 text-xs text-[rgb(var(--muted))]">Téc asignado: {wo.assigned_to_name ?? "—"}</div>
              </div>
            )}
          </div>

          <div className="mt-3">
            <Label>Servicio</Label>
            <Input value={wo.service ?? ""} onChange={(e) => setWo({ ...wo, service: e.target.value })} onBlur={() => saveCore({ service: wo.service })} />
          </div>
          <div className="mt-3">
            <Label>Descripción</Label>
            <textarea
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
              rows={4}
              value={wo.description ?? ""}
              onChange={(e) => setWo({ ...wo, description: e.target.value })}
              onBlur={() => saveCore({ description: wo.description })}
            />
          </div>
          <div className="mt-3 text-xs text-[rgb(var(--muted))]">Tip: se guarda al salir del campo (blur).</div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold">Cliente</div>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <div>
              <Label>Nombre</Label>
              <Input value={wo.client_name} onChange={(e) => setWo({ ...wo, client_name: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={wo.phone} onChange={(e) => setWo({ ...wo, phone: e.target.value.replace(/\D/g, "") })} />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={wo.address} onChange={(e) => setWo({ ...wo, address: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => saveClient({ client_name: wo.client_name, phone: wo.phone, address: wo.address })}>Guardar cliente</Button>
            </div>
          </div>

          <div className="mt-6">
            <div className="font-semibold">Etiquetas</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {allTags.map((t) => {
                const active = wo.tags?.some((x) => x.id === t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTag(t.id)}
                    className={"text-xs rounded-full border px-3 py-1 transition " + (active ? "bg-white/10" : "hover:bg-white/5")}
                    style={{ borderColor: t.color, color: t.color }}
                    title={active ? "Quitar" : "Agregar"}
                  >
                    {t.name}
                  </button>
                );
              })}
              {!allTags.length ? <div className="text-xs text-[rgb(var(--muted))]">Sin etiquetas.</div> : null}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label>Nueva etiqueta</Label>
                <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Ej: Urgente" />
              </div>
              <div>
                <Label>Color</Label>
                <Input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button variant="ghost" onClick={createTag} disabled={!newTagName.trim()}>
                  Crear etiqueta
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
