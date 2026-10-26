// Adjuntos de comunicados: mismo flujo que los de Asambleas (preparar, subir, validar, descartar).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isValidDocument } from "@/lib/documents/validation";
import { readJsonObject } from "@/lib/documents/request-body";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maximumSize = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  let payload: Record<string, unknown>;
  try { payload = await readJsonObject(request); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  const propertyId = String(payload.propertyId ?? "");
  if (!uuidPattern.test(propertyId)) return NextResponse.json({ error: "Comunidad inválida." }, { status: 400 });
  const { data: membership } = await supabase.from("property_members").select("roles")
    .eq("property_id", propertyId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!membership?.roles.includes("administrator")) return NextResponse.json({ error: "No tienes permiso." }, { status: 404 });
  const admin = createAdminClient();

  if (payload.action === "prepare") {
    const name = String(payload.name ?? "").trim();
    const mimeType = String(payload.mimeType ?? ""), size = Number(payload.size);
    if (!name || name.length > 180 || !allowedTypes.has(mimeType)
      || !Number.isInteger(size) || size < 1 || size > maximumSize) return NextResponse.json({ error: "Selecciona un PDF, JPG o PNG de máximo 10 MB." }, { status: 400 });
    const id = crypto.randomUUID(), extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/jpeg" ? "jpg" : "png";
    const path = `${propertyId}/announcement-staging/${user.id}/${id}.${extension}`;
    const { error: insertError } = await admin.from("announcement_upload_staging").insert({ id, property_id: propertyId,
      uploaded_by: user.id, object_path: path, original_name: name, mime_type: mimeType, size_bytes: size });
    if (insertError) return NextResponse.json({ error: "No se pudo preparar el documento." }, { status: 500 });
    const { data: signed, error: signedError } = await admin.storage.from("private-documents").createSignedUploadUrl(path, { upsert: false });
    if (signedError || !signed) {
      await admin.from("announcement_upload_staging").delete().eq("id", id);
      return NextResponse.json({ error: "No se pudo preparar la carga." }, { status: 500 });
    }
    return NextResponse.json({ id, path, token: signed.token });
  }

  const id = String(payload.id ?? "");
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  const { data: staged } = await admin.from("announcement_upload_staging").select("id,object_path,mime_type,size_bytes,status,expires_at")
    .eq("id", id).eq("property_id", propertyId).eq("uploaded_by", user.id).maybeSingle();
  if (!staged || staged.status === "consumed") return NextResponse.json({ error: "Documento no disponible." }, { status: 404 });

  if (payload.action === "discard") {
    await admin.storage.from("private-documents").remove([staged.object_path]);
    await admin.from("announcement_upload_staging").delete().eq("id", id).eq("uploaded_by", user.id);
    return NextResponse.json({ success: true });
  }
  if (payload.action === "finalize") {
    if (staged.status !== "pending" || new Date(staged.expires_at) <= new Date()) return NextResponse.json({ error: "La carga venció." }, { status: 400 });
    const { data: blob, error: downloadError } = await admin.storage.from("private-documents").download(staged.object_path);
    if (downloadError || !blob) return NextResponse.json({ error: "No se encontró el documento." }, { status: 400 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!isValidDocument(bytes, staged.mime_type, Number(staged.size_bytes))) return NextResponse.json({ error: "El contenido no coincide con un PDF, JPG o PNG válido." }, { status: 400 });
    const { error } = await admin.from("announcement_upload_staging").update({ status: "validated" }).eq("id", id).eq("status", "pending");
    if (error) return NextResponse.json({ error: "No se pudo validar el documento." }, { status: 500 });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
}
