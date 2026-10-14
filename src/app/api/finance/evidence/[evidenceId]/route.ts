import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params;
  if (!uuidPattern.test(evidenceId)) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  // A missing RLS-visible row and an unknown ID share the same response.
  const { data: evidence } = await supabase.from("finance_payment_evidence").select("bucket,object_path").eq("id", evidenceId).maybeSingle();
  if (!evidence) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const { data, error } = await createAdminClient().storage.from(evidence.bucket).createSignedUrl(evidence.object_path, 300);
  if (error || !data) return NextResponse.json({ error: "No se pudo descargar el comprobante." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
