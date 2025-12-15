"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button, Card, Input } from "@/components/ui";

type Task = { id: string; title: string; done: boolean; created_at: string; };

export default function UI() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [items, setItems] = useState<Task[]>([]);
  const [title, setTitle] = useState("");

  async function load() {
    const { data } = await supabase.from("tasks").select("id,title,done,created_at").order("created_at", { ascending: false }).limit(200);
    setItems((data ?? []) as any);
  }
  useEffect(()=>{ load(); }, []);

  async function add() {
    const { error } = await supabase.from("tasks").insert({ title });
    if (error) alert(error.message);
    setTitle(""); await load();
  }
  async function toggle(id: string, done: boolean) {
    const { error } = await supabase.from("tasks").update({ done: !done }).eq("id", id);
    if (error) alert(error.message);
    await load();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex gap-2">
          <Input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Nueva tarea..." />
          <Button onClick={add} disabled={!title}>Agregar</Button>
        </div>
      </Card>
      <div className="space-y-2">
        {items.map(t => (
          <Card key={t.id} className="p-3 flex items-center justify-between">
            <div className={t.done ? "line-through text-[rgb(var(--muted))]" : ""}>{t.title}</div>
            <Button variant="ghost" onClick={()=>toggle(t.id, t.done)}>{t.done ? "Reabrir" : "Hecha"}</Button>
          </Card>
        ))}
        {!items.length && <div className="text-sm text-[rgb(var(--muted))]">Sin tareas.</div>}
      </div>
    </div>
  );
}
