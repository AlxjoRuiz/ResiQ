import { NextResponse } from "next/server";
import { isValidDocument } from "@/lib/documents/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Marcar llegada o salida del trabajador de mantenimiento (entrega 3, 28/10/2026).
// Desde el 29/10/2026 solo la llegada lleva foto; la salida se marca sin foto. La foto llega ya
// reducida desde el celular (JPEG). La hora la pone la base de datos (now()), nunca el dispositivo.
// Llegada: primero se valida la cuenta, luego se sube la foto y por último se marca; si la marca
// falla, la foto se borra.
const maximumSize = 4 * 1024 * 1024;
const messages: Record<string, string> = {
  already_checked_in: "Ya marcaste tu llegada. Marca la salida antes de una nueva llegada.",
  not_checked_in: "No tienes una llegada abierta. Marca primero tu llegada.",
  not_authorized: "Solo un trabajador de mantenimiento activo puede marcar asistencia.",
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > maximumSize + 512 * 1024) return NextResponse.json({ error: "La foto es muy pesada." }, { status: 413 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const { data: staff } = await supabase.from("maintenance_staff").select("id,role,status").eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!staff || staff.role !== "worker") return NextResponse.json({ error: messages.not_authorized }, { status: 403 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  const kind = String(form.get("kind") ?? "");
  if (kind !== "in" && kind !== "out") return NextResponse.json({ error: "Indica si es llegada o salida." }, { status: 400 });
  if (kind === "out") {
    // Salida sin foto: la función de la base valida el rol, la jornada abierta y pone la hora.
    const { data: markedAt, error } = await supabase.rpc("maintenance_check_out");
    if (error) {
      const code = Object.keys(messages).find((key) => error.message.includes(key));
      return NextResponse.json({ error: code ? messages[code] : "No pudimos marcar. Intenta de nuevo." }, { status: 409 });
    }
    return NextResponse.json({ success: true, markedAt });
  }
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.type !== "image/jpeg" || photo.size < 1 || photo.size > maximumSize) return NextResponse.json({ error: "Toma la foto con la cámara para marcar." }, { status: 400 });
  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (!isValidDocument(bytes, photo.type, photo.size)) return NextResponse.json({ error: "La foto no es válida." }, { status: 400 });

  const admin = createAdminClient();
  const objectPath = `maintenance/attendance/${staff.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await admin.storage.from("private-documents").upload(objectPath, bytes, { contentType: "image/jpeg", upsert: false });
  if (uploadError) return NextResponse.json({ error: "No se pudo guardar la foto. Intenta de nuevo." }, { status: 500 });
  // La función de la base valida de nuevo el rol, que no haya jornada abierta y pone la hora del servidor.
  const { data: markedAt, error } = await supabase.rpc("maintenance_check_in", { target_photo_path: objectPath });
  if (error) {
    await admin.storage.from("private-documents").remove([objectPath]);
    const code = Object.keys(messages).find((key) => error.message.includes(key));
    return NextResponse.json({ error: code ? messages[code] : "No pudimos marcar. Intenta de nuevo." }, { status: 409 });
  }
  return NextResponse.json({ success: true, markedAt });
}
