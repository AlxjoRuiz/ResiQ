import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Adjunto de un requerimiento o de una respuesta (05/11/2026): la base de datos revisa que el conjunto esté
// asignado a la abogada y deja la consulta en auditoría; el archivo se abre con un enlace temporal de 5 minutos.
export async function GET(_: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await params;
  if (!uuidPattern.test(attachmentId)) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await supabase.rpc("legal_attachment_file", { target_attachment_id: attachmentId });
  const file = Array.isArray(data) ? data[0] as { object_path: string; original_name: string } | undefined : undefined;
  if (error || !file) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const { data: signed, error: signError } = await createAdminClient().storage.from("private-documents").createSignedUrl(file.object_path, 300, { download: file.original_name });
  if (signError || !signed) return NextResponse.json({ error: "No se pudo abrir el archivo." }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
