import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maximumSize = 10 * 1024 * 1024;

function isExpectedSignature(bytes: Uint8Array, mimeType: string) {
  const signatures: Record<string, number[]> = {
    "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  };
  return signatures[mimeType]?.every((value, index) => bytes[index] === value) ?? false;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });

  let payload: Record<string, unknown>;
  try { payload = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }

  if (payload.action === "prepare") {
    const pqrsId = String(payload.pqrsId ?? "");
    const name = String(payload.name ?? "").trim();
    const mimeType = String(payload.mimeType ?? "");
    const size = Number(payload.size);
    if (!uuidPattern.test(pqrsId) || !name || name.length > 180 || !allowedTypes.has(mimeType) || !Number.isInteger(size) || size < 1 || size > maximumSize) return NextResponse.json({ error: "El archivo no cumple los requisitos." }, { status: 400 });
    const { data, error } = await supabase.rpc("prepare_pqrs_document", { target_pqrs_id: pqrsId, target_message_id: null, target_original_name: name, target_mime_type: mimeType, target_size_bytes: size });
    const prepared = Array.isArray(data) ? data[0] : undefined;
    if (error || !prepared) return NextResponse.json({ error: error?.message.includes("file_limit") ? "La PQRS ya tiene 5 adjuntos." : "No fue posible preparar el archivo." }, { status: 400 });
    const { data: signed, error: signedError } = await supabase.storage.from("private-documents").createSignedUploadUrl(prepared.object_path, { upsert: false });
    if (signedError || !signed) {
      await supabase.rpc("reject_pqrs_document", { target_document_id: prepared.document_id, target_reason: "signed_upload_failed" });
      return NextResponse.json({ error: "No fue posible preparar la carga." }, { status: 500 });
    }
    return NextResponse.json({ documentId: prepared.document_id, path: prepared.object_path, token: signed.token });
  }

  if (payload.action === "finalize") {
    const documentId = String(payload.documentId ?? "");
    if (!uuidPattern.test(documentId)) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
    const { data: document } = await supabase.from("documents").select("id,bucket,object_path,mime_type,size_bytes,status").eq("id", documentId).maybeSingle();
    if (!document || document.status !== "pending") return NextResponse.json({ error: "Documento no disponible." }, { status: 404 });
    const { data: blob, error: downloadError } = await supabase.storage.from(document.bucket).download(document.object_path);
    if (downloadError || !blob) return NextResponse.json({ error: "No se encontró el archivo cargado." }, { status: 400 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const valid = bytes.length === Number(document.size_bytes) && bytes.length <= maximumSize && allowedTypes.has(document.mime_type) && isExpectedSignature(bytes, document.mime_type);
    if (!valid) {
      await supabase.rpc("reject_pqrs_document", { target_document_id: document.id, target_reason: "content_validation_failed" });
      return NextResponse.json({ error: "El contenido no coincide con un PDF, JPG o PNG válido." }, { status: 400 });
    }
    const { error } = await supabase.rpc("complete_pqrs_document", { target_document_id: document.id });
    if (error) return NextResponse.json({ error: "No fue posible publicar el adjunto." }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
}
