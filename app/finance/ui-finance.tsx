"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button, Card, Input, Label, Select } from "@/components/ui";

type SeriesRow = { day: string; income: number; expense: number; balance: number };
type SummaryRow = { total_income: number; total_expense: number; balance: number; income_by_category: any; expense_by_category: any };
type Entry = { id: string; entry_date: string; entry_type: "income" | "expense"; amount: number; category: string; note: string | null; created_at: string };

function money(n: any) {
  const v = typeof n === "number" ? n : Number(n || 0);
  return v.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateInput(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function BarChart({ data, kind }: { data: SeriesRow[]; kind: "income" | "expense" | "balance" }) {
  // Simple SVG bar chart (no deps)
  const w = 600;
  const h = 160;
  const pad = 10;
  const values = data.map((r) => (kind === "income" ? r.income : kind === "expense" ? r.expense : r.balance));
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const bw = Math.max(2, (w - pad * 2) / Math.max(1, data.length) - 1);
  const zeroY = h / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
      <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="currentColor" opacity={0.2} />
      {data.map((r, i) => {
        const v = kind === "income" ? r.income : kind === "expense" ? r.expense : r.balance;
        const x = pad + i * (bw + 1);
        const barH = (Math.abs(v) / max) * (h / 2 - pad);
        const y = v >= 0 ? zeroY - barH : zeroY;
        return <rect key={r.day} x={x} y={y} width={bw} height={barH} rx={2} />;
      })}
    </svg>
  );
}

export default function FinanceUI() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const today = new Date();
  const [from, setFrom] = useState(toDateInput(startOfMonth(today)));
  const [to, setTo] = useState(toDateInput(endOfMonth(today)));
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  // New entry form
  const [entryDate, setEntryDate] = useState(toDateInput(today));
  const [entryType, setEntryType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("General");
  const [note, setNote] = useState<string>("");

  async function load() {
    setLoading(true);
    const { data: s, error: e1 } = await supabase.rpc("finance_series", { p_from: from, p_to: to });
    if (e1) alert(e1.message);
    setSeries(((s ?? []) as any) as SeriesRow[]);

    const { data: sm, error: e2 } = await supabase.rpc("finance_summary", { p_from: from, p_to: to });
    if (e2) alert(e2.message);
    setSummary(((sm?.[0] ?? null) as any) as SummaryRow | null);

    const { data: rows } = await supabase
      .from("finance_entries")
      .select("id,entry_date,entry_type,amount,category,note,created_at")
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    setEntries((rows ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function addEntry() {
    const a = Number(amount);
    if (!entryDate || !entryType || !isFinite(a) || a <= 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("finance_entries").insert({
      entry_date: entryDate,
      entry_type: entryType,
      amount: a,
      category: category.trim() || "General",
      note: note.trim() || null,
      created_by: user.id,
    });
    if (error) alert(error.message);
    setAmount("");
    setNote("");
    await load();
  }

  async function removeEntry(id: string) {
    const { error } = await supabase.from("finance_entries").delete().eq("id", id);
    if (error) alert(error.message);
    await load();
  }

  const avgDaily = series.length ? series.reduce((a, r) => a + (r.balance || 0), 0) / series.length : 0;
  const best = series.reduce((m, r) => (r.balance > m.balance ? r : m), series[0] ?? ({ balance: 0 } as any));
  const worst = series.reduce((m, r) => (r.balance < m.balance ? r : m), series[0] ?? ({ balance: 0 } as any));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Finanzas</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">Registra ingresos y gastos, con balance y gráficas.</p>
      </div>

      <Card className="p-4">
        <div className="font-semibold">Rango</div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label>Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="md:flex md:items-end md:justify-end">
            <Button variant="ghost" onClick={load} disabled={loading}>
              Refrescar
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-[rgb(var(--muted))]">Ingresos</div>
          <div className="text-2xl font-semibold">{money(summary?.total_income ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[rgb(var(--muted))]">Gastos</div>
          <div className="text-2xl font-semibold">{money(summary?.total_expense ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[rgb(var(--muted))]">Balance</div>
          <div className="text-2xl font-semibold">{money(summary?.balance ?? 0)}</div>
          <div className="mt-1 text-xs text-[rgb(var(--muted))]">Promedio diario: {money(avgDaily)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="font-semibold">Balance diario</div>
          <div className="mt-3">
            <BarChart data={series} kind="balance" />
          </div>
          <div className="mt-2 text-xs text-[rgb(var(--muted))]">
            Mejor día: {best?.day ?? "—"} ({money(best?.balance ?? 0)}) · Peor día: {worst?.day ?? "—"} ({money(worst?.balance ?? 0)})
          </div>
        </Card>
        <Card className="p-4">
          <div className="font-semibold">Ingresos / Gastos</div>
          <div className="mt-3">
            <div className="text-xs text-[rgb(var(--muted))]">Ingresos</div>
            <BarChart data={series} kind="income" />
            <div className="mt-2 text-xs text-[rgb(var(--muted))]">Gastos</div>
            <BarChart data={series} kind="expense" />
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="font-semibold">Agregar movimiento</div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={entryType} onChange={(e) => setEntryType(e.target.value as any)}>
              <option value="income">Ingreso</option>
              <option value="expense">Gasto</option>
            </Select>
          </div>
          <div>
            <Label>Monto</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="md:col-span-2">
            <Label>Categoría</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ej: Combustible" />
          </div>
          <div className="md:col-span-6">
            <Label>Nota</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="md:col-span-6 flex justify-end">
            <Button onClick={addEntry} disabled={!amount || Number(amount) <= 0}>
              Guardar
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="font-semibold">Movimientos</div>
        <div className="mt-3 max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-[rgb(var(--muted))]">
              <tr>
                <th className="text-left py-2">Fecha</th>
                <th className="text-left py-2">Tipo</th>
                <th className="text-left py-2">Categoría</th>
                <th className="text-right py-2">Monto</th>
                <th className="text-left py-2">Nota</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="py-2">{e.entry_date}</td>
                  <td className="py-2">{e.entry_type === "income" ? "Ingreso" : "Gasto"}</td>
                  <td className="py-2">{e.category}</td>
                  <td className="py-2 text-right">{money(e.amount)}</td>
                  <td className="py-2">{e.note ?? ""}</td>
                  <td className="py-2 text-right">
                    <Button variant="ghost" onClick={() => removeEntry(e.id)}>
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
              {!entries.length ? (
                <tr>
                  <td colSpan={6} className="py-4 text-xs text-[rgb(var(--muted))]">
                    Sin movimientos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
