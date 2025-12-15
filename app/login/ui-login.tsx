"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button, Input, Label } from "@/components/ui";

export default function LoginForm() {
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else window.location.href = "/";
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label>Email</Label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <Label>Contraseña</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button className="w-full" disabled={loading}>{loading ? "Ingresando..." : "Ingresar"}</Button>
      <p className="text-xs text-[rgb(var(--muted))]">No hay registro público.</p>
    </form>
  );
}
