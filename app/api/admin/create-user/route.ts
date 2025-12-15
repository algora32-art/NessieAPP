import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (me?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { email, password, name, role } = body ?? {};
    if (!email || !password || !name || !role) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const admin = supabaseAdmin();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 });

    const newId = created.data.user?.id;
    if (!newId) return NextResponse.json({ error: "No user id" }, { status: 500 });

    const ins = await admin.from("profiles").insert({ id: newId, name, role, active: true });
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
