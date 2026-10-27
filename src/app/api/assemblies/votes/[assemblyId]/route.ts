import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Votaciones de una asamblea para la actualización en vivo. get_assembly_votes valida el acceso y
// solo entrega totales a Administración o cuando la votación está cerrada.
export async function GET(_: Request, { params }: { params: Promise<{ assemblyId: string }> }) {
  const { assemblyId } = await params;
  if (!uuidPattern.test(assemblyId)) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await supabase.rpc("get_assembly_votes", { target_assembly_id: assemblyId });
  if (error) return NextResponse.json({ error: "No disponible." }, { status: 500 });
  return NextResponse.json({ votes: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
