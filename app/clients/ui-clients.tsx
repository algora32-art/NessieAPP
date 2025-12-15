"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Card, Input } from "@/components/ui";

type Client = { id: string; name: string; phone: string; address: string; created_at: string; };

export default function UI() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Client[]>([]);

  function waLink(p: string) {
    const clean = (p || "").replace(/[^0-9]/g, "");
    return `https://wa.me/${clean}`;
  }

  async function load() {
    const query = supabase.from("clients").select("id,name,phone,address,created_at").order("created_at", { ascending: false }).limit(200);
    const { data } = q ? await query.ilike("name", `%${q}%`) : await query;
    setItems((data ?? []) as any);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  return (
    <div className="space-y-4">
      <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar..." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map(c => (
          <Card key={c.id} className="p-4">
            <div className="font-semibold">{c.name}</div>
            <div className="mt-1 text-sm">{c.phone}</div>
            <div className="mt-1 text-xs text-[rgb(var(--muted))]">{c.address}</div>
            <div className="mt-3"><a className="text-sm underline" href={waLink(c.phone)} target="_blank" rel="noreferrer">WhatsApp</a></div>
          </Card>
        ))}
        {!items.length && <div className="text-sm text-[rgb(var(--muted))]">Sin clientes.</div>}
      </div>
    </div>
  );
}
