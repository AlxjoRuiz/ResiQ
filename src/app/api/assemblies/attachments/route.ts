import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidDocument } from "@/lib/documents/validation";
import { readJsonObject } from "@/lib/documents/request-body";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]), allowedKinds = new Set(["convocation", "support", "minutes", "representation_evidence"]), maximumSize = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const origin = request.headers.get("origin"); if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  let payload: Record<string, unknown>; try { payload = await readJsonObject(request); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  if (payload.action === "prepare") {
    const assemblyId = String(payload.assemblyId ?? ""), representationId = String(payload.representationId ?? ""), kind = String(payload.kind ?? ""), name = String(payload.name ?? "").trim(), mimeType = String(payload.mimeType ?? ""), size = Number(payload.size);
    if (!uuidPattern.test(assemblyId) || (representationId && !uuidPattern.test(representationId)) || !allowedKinds.has(kind) || !name || name.length > 180 || !allowedTypes.has(mimeType) || !Number.isInteger(size) || size < 1 || size > maximumSize) return NextResponse.json({ error: "El archivo no cumple los requisitos." }, { status: 400 });
    const { data, error } = await supabase.rpc("prepare_assembly_document", { target_assembly_id: assemblyId, target_representation_id: representationId || null, target_document_kind: kind, target_original_name: name, target_mime_type: mimeType, target_size_bytes: size });
    const prepared = Array.isArray(data) ? data[0] : undefined; if (error || !prepared) return NextResponse.json({ error: error?.message.includes("file_limit") ? "La representación ya tiene cinco evidencias." : "No fue posible preparar el archivo." }, { status: 400 });
    const { data: signed, error: signedError } = await supabase.storage.from("private-documents").createSignedUploadUrl(prepared.object_path, { upsert: false });
    if (signedError || !signed) { await supabase.rpc("reject_assembly_document", { target_document_id: prepared.document_id, target_reason: "signed_upload_failed" }); return NextResponse.json({ error: "No fue posible preparar la carga." }, { status: 500 }); }
    return NextResponse.json({ documentId: prepared.document_id, path: prepared.object_path, token: signed.token });
  }
  if (payload.action === "finalize") {
    const documentId = String(payload.documentId ?? ""); if (!uuidPattern.test(documentId)) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
    const { data: document } = await supabase.from("documents").select("id,bucket,object_path,mime_type,size_bytes,status,assembly_id,assembly_representation_id").eq("id", documentId).maybeSingle();
    if ((!document?.assembly_id && !document?.assembly_representation_id) || document.status !== "pending") return NextResponse.json({ error: "Documento no disponible." }, { status: 404 });
    const { data: blob, error: downloadError } = await supabase.storage.from(document.bucket).download(document.object_path); if (downloadError || !blob) return NextResponse.json({ error: "No se encontró el archivo cargado." }, { status: 400 });
    const bytes = new Uint8Array(await blob.arrayBuffer()); const valid = isValidDocument(bytes, document.mime_type, Number(document.size_bytes));
    if (!valid) { await supabase.rpc("reject_assembly_document", { target_document_id: document.id, target_reason: "content_validation_failed" }); return NextResponse.json({ error: "El contenido no coincide con un PDF, JPG o PNG válido." }, { status: 400 }); }
    const { error } = await createAdminClient().rpc("complete_verified_document", { target_document_id: document.id, target_actor_id: user.id, target_size_bytes: bytes.length, target_mime_type: document.mime_type }); if (error) return NextResponse.json({ error: "No fue posible publicar el documento." }, { status: 400 });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
}

