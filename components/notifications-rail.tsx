"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button, Card } from "./ui";
import { format } from "date-fns";

type Notif = { id: string; created_at: string; title: string; body: string; user_id: string; read_at: string | null; type: string; entity_id: string | null };

export function NotificationsRail() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [items, setItems] = useState<Notif[]>([]);
  const [me, setMe] = useState<string>("");
  const unread = items.filter(i => !i.read_at).length;
  const subscribed = useRef(false);

  function mergeUnique(next: Notif[]) {
    const seen = new Set<string>();
    const out: Notif[] = [];
    for (const n of next) {
      if (!n?.id) continue;
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push(n);
    }
    return out;
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMe(user.id);
      const { data } = await supabase
        .from("notifications")
        .select("id, created_at, title, body, user_id, read_at, type, entity_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (mounted) setItems(mergeUnique(((data ?? []) as any) as Notif[]).slice(0, 50));
    })();

    // Prevent duplicate subscriptions (React Strict Mode / hot reload).
    if (subscribed.current) return;
    subscribed.current = true;

    const channel = supabase
      .channel("notif-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        const incoming = payload.new as any as Notif;
        if (me && incoming.user_id !== me) return;
        setItems((prev) => mergeUnique([incoming, ...prev]).slice(0, 50));
      })
      .subscribe();

    return () => {
      mounted = false;
      subscribed.current = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, me]);

  async function markAllRead() {
    if (!me) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", me)
      .is("read_at", null);
    if (!error) {
      setItems((prev) => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    }
  }

  async function markOneRead(id: string) {
    if (!me) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", me);
    if (!error) setItems((prev) => prev.map(n => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)));
  }

  return (
    <aside className="w-80 border-l bg-[rgb(var(--card))] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">Notificaciones</div>
        <div className="flex items-center gap-2">
          {unread ? <span className="text-xs rounded-full border px-2 py-1">{unread} nuevas</span> : null}
          <Button variant="ghost" onClick={markAllRead} disabled={!unread}>Marcar todo leído</Button>
        </div>
      </div>

      <div className="mt-4 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 space-y-3">
        {items.map((n) => (
          <Card key={n.id} className={"p-3 " + (!n.read_at ? "border-white/30" : "") }>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium">{n.title}</div>
              <div className="text-xs text-[rgb(var(--muted))]">{format(new Date(n.created_at), "dd/MM HH:mm")}</div>
            </div>
            <div className="mt-1 text-xs text-[rgb(var(--muted))]">{n.body}</div>
            {!n.read_at ? (
              <div className="mt-2 flex justify-end">
                <Button variant="ghost" onClick={() => markOneRead(n.id)}>Marcar leído</Button>
              </div>
            ) : null}
          </Card>
        ))}
        {!items.length && <div className="text-sm text-[rgb(var(--muted))]">Sin notificaciones.</div>}
      </div>
    </aside>
  );
}
