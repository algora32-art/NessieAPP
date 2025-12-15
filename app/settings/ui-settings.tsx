"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button, Card, Input, Label } from "@/components/ui";

type Tag = { id: string; name: string; color: string; };

export default function UI() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#34d399");
  const [uploading, setUploading] = useState(false);

  async function load() {
    const { data } = await supabase.from("tags").select("id,name,color").order("name");
    setTags((data ?? []) as any);
  }
  useEffect(()=>{ load(); }, []);

  async function addTag() {
    const { error } = await supabase.from("tags").insert({ name, color });
    if (error) alert(error.message);
    setName(""); await load();
  }
  async function removeTag(id: string) {
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) alert(error.message);
    await load();
  }

  async function onAvatar(file: File | null) {
    if (!file) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (up.error) { alert(up.error.message); setUploading(false); return; }
    const pub = supabase.storage.from("avatars").getPublicUrl(path);
    const avatar_url = pub.data.publicUrl;
    const { error } = await supabase.from("profiles").update({ avatar_url }).eq("id", user.id);
    if (error) alert(error.message);
    setUploading(false);
    alert("Foto actualizada.");
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <div className="font-semibold">Foto de perfil</div>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">Sube una imagen.</p>
        <div className="mt-3">
          <Label>Archivo</Label>
          <input type="file" accept="image/*" className="mt-2 block w-full text-sm" onChange={(e)=>onAvatar(e.target.files?.[0] ?? null)} />
          {uploading && <div className="mt-2 text-sm text-[rgb(var(--muted))]">Subiendo...</div>}
        </div>
      </Card>

      <Card className="p-4">
        <div className="font-semibold">Etiquetas</div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e)=>setName(e.target.value)} />
          </div>
          <div>
            <Label>Color</Label>
            <input type="color" value={color} onChange={(e)=>setColor(e.target.value)} className="mt-2 h-10 w-full rounded-lg border bg-transparent" />
          </div>
        </div>
        <div className="mt-4"><Button onClick={addTag} disabled={!name}>Crear etiqueta</Button></div>
        <div className="mt-4 space-y-2">
          {tags.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border p-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="text-sm">{t.name}</span>
              </div>
              <Button variant="ghost" onClick={()=>removeTag(t.id)}>Eliminar</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
