import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Comprobante de pago para la abogada (04/11/2026): la base de datos revisa que el conjunto esté asignado y
// deja la consulta en auditoría; el archivo se abre con un enlace temporal de 5 minutos.
export async function GET(_: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params;
  if (!uuidPattern.test(evidenceId)) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await supabase.rpc("legal_evidence_file", { target_evidence_id: evidenceId });
  const file = Array.isArray(data) ? data[0] as { bucket: string; object_path: string } | undefined : undefined;
  if (error || !file) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const { data: signed, error: signError } = await createAdminClient().storage.from(file.bucket).createSignedUrl(file.object_path, 300);
  if (signError || !signed) return NextResponse.json({ error: "No se pudo abrir el comprobante." }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
