import { NextResponse } from "next/server";
import { isValidDocument } from "@/lib/documents/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Entregar una tarea de mantenimiento con 1 a 5 fotos (entrega 4, 28/10/2026).
// Las fotos llegan ya reducidas desde el celular (JPEG). Vercel no acepta envíos de más de 4,5 MB, así
// que el total se limita a 4 MB. Se suben las fotos y luego la base valida dueño, estado y rutas; si la
// entrega falla, las fotos se borran.
const maximumTotal = 4 * 1024 * 1024;
const uuidPattern = /^[0-9a-f-]{36}$/i;
const messages: Record<string, string> = {
  not_found: "No encontramos esa tarea.",
  not_open: "Esta tarea ya fue entregada.",
  photo_required: "Agrega entre 1 y 5 fotos.",
  not_authorized: "Solo un trabajador de mantenimiento activo puede entregar tareas.",
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > maximumTotal + 256 * 1024) return NextResponse.json({ error: "Las fotos pesan demasiado. Envía menos fotos." }, { status: 413 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const { data: staff } = await supabase.from("maintenance_staff").select("id,role,status").eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!staff || staff.role !== "worker") return NextResponse.json({ error: messages.not_authorized }, { status: 403 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  const taskId = String(form.get("taskId") ?? ""), note = String(form.get("note") ?? "").trim();
  const photos = form.getAll("photos");
  if (!uuidPattern.test(taskId)) return NextResponse.json({ error: messages.not_found }, { status: 400 });
  if (note.length > 1000) return NextResponse.json({ error: "La nota admite máximo 1.000 caracteres." }, { status: 400 });
  if (photos.length < 1 || photos.length > 5) return NextResponse.json({ error: messages.photo_required }, { status: 400 });
  const files: Uint8Array[] = [];
  for (const photo of photos) {
    if (!(photo instanceof File) || photo.type !== "image/jpeg" || photo.size < 1 || photo.size > maximumTotal) return NextResponse.json({ error: "Una de las fotos no es válida." }, { status: 400 });
    const bytes = new Uint8Array(await photo.arrayBuffer());
    if (!isValidDocument(bytes, photo.type, photo.size)) return NextResponse.json({ error: "Una de las fotos no es válida." }, { status: 400 });
    files.push(bytes);
  }

  const admin = createAdminClient();
  const paths: string[] = [];
  for (const bytes of files) {
    const path = `maintenance/tasks/${staff.id}/${taskId}/${crypto.randomUUID()}.jpg`;
    const { error } = await admin.storage.from("private-documents").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (error) {
      if (paths.length) await admin.storage.from("private-documents").remove(paths);
      return NextResponse.json({ error: "No se pudieron guardar las fotos. Intenta de nuevo." }, { status: 500 });
    }
    paths.push(path);
  }
  const { error } = await supabase.rpc("maintenance_submit_task", { target_task_id: taskId, target_note: note, target_photo_paths: paths });
  if (error) {
    await admin.storage.from("private-documents").remove(paths);
    const code = Object.keys(messages).find((key) => error.message.includes(key));
    return NextResponse.json({ error: code ? messages[code] : "No pudimos entregar la tarea. Intenta de nuevo." }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
