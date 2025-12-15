"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button, Card, Input, Label, Select } from "@/components/ui";

type Profile = { id: string; name: string; role: "admin"|"technician"; active: boolean; };

export default function UI() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [items, setItems] = useState<Profile[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin"|"technician">("technician");
  const [creating, setCreating] = useState(false);

  async function load() {
    const { data } = await supabase.from("profiles").select("id,name,role,active").order("created_at", { ascending: false });
    setItems((data ?? []) as any);
  }
  useEffect(()=>{ load(); }, []);

  async function createUser() {
    setCreating(true);
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name, role })
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) { alert(body?.error ?? "Error"); return; }
    setEmail(""); setPassword(""); setName(""); setRole("technician");
    await load();
    alert("Usuario creado.");
  }

  async function updateProfile(p: Profile) {
    const { error } = await supabase.from("profiles").update({ name: p.name, role: p.role, active: p.active }).eq("id", p.id);
    if (error) alert(error.message);
    await load();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="font-semibold">Crear usuario</div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div><Label>Email</Label><Input value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
          <div><Label>Contraseña</Label><Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
          <div><Label>Nombre</Label><Input value={name} onChange={(e)=>setName(e.target.value)} /></div>
          <div><Label>Rol</Label>
            <Select value={role} onChange={(e)=>setRole(e.target.value as any)}>
              <option value="technician">technician</option>
              <option value="admin">admin</option>
            </Select>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={createUser} disabled={creating || !email || !password || !name}>{creating ? "Creando..." : "Crear"}</Button>
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--muted))]">Requiere SUPABASE_SERVICE_ROLE_KEY en el servidor.</p>
      </Card>

      <Card className="p-4">
        <div className="font-semibold">Lista</div>
        <div className="mt-3 space-y-2">
          {items.map(u => (
            <div key={u.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-[rgb(var(--muted))] break-all">{u.id}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={u.role} onChange={(e)=>updateProfile({ ...u, role: e.target.value as any })}>
                    <option value="technician">technician</option>
                    <option value="admin">admin</option>
                  </Select>
                  <Button variant="ghost" onClick={()=>updateProfile({ ...u, active: !u.active })}>{u.active ? "Desactivar" : "Activar"}</Button>
                </div>
              </div>
            </div>
          ))}
          {!items.length && <div className="text-sm text-[rgb(var(--muted))]">Sin usuarios.</div>}
        </div>
      </Card>
    </div>
  );
}
