import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Deudas con saldo de un apartamento para armar un acuerdo de pago (05/11/2026). Solo el admin del conjunto.
// El total del acuerdo es la suma del saldo de las deudas que elija; la base de datos lo vuelve a revisar al guardar.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get("propertyId") ?? "", unitId = url.searchParams.get("unitId") ?? "";
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(unitId)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const { data: membership } = await supabase.from("property_members").select("roles").eq("property_id", propertyId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!membership?.roles.includes("administrator")) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const [{ data: receivables, error }, { data: allocations }] = await Promise.all([
    supabase.from("accounts_receivable").select("id,concept,amount,due_on").eq("property_id", propertyId).eq("unit_id", unitId).eq("status", "active").order("due_on", { ascending: true }),
    supabase.from("payment_allocations").select("receivable_id,amount,payments!inner(status)").eq("property_id", propertyId).eq("unit_id", unitId).eq("payments.status", "posted"),
  ]);
  if (error) return NextResponse.json({ error: "No se pudieron cargar las deudas." }, { status: 500 });
  const applied = new Map<string, number>();
  for (const row of allocations ?? []) applied.set(row.receivable_id, (applied.get(row.receivable_id) ?? 0) + Number(row.amount));
  const debts = (receivables ?? []).map((row) => ({ id: row.id, concept: row.concept, due_on: row.due_on, outstanding: Math.round((Number(row.amount) - (applied.get(row.id) ?? 0)) * 100) / 100 })).filter((row) => row.outstanding > 0);
  return NextResponse.json({ debts }, { headers: { "cache-control": "no-store" } });
}
