import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isValidDocument } from "@/lib/documents/validation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maximumSize = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > maximumSize + 1024 * 1024) return NextResponse.json({ error: "El archivo supera 5 MB." }, { status: 413 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  const receivableId = String(form.get("receivableId") ?? "");
  const file = form.get("file");
  // Mes que paga (AAAA-MM, obligatorio) y comentario opcional para la administración.
  const paidMonth = String(form.get("paidMonth") ?? "").trim();
  const comment = String(form.get("comment") ?? "").trim();
  // Valor que el residente pagó o abonó a la obligación elegida.
  const amount = Number(form.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) return NextResponse.json({ error: "Escribe el valor que pagaste." }, { status: 400 });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(paidMonth)) return NextResponse.json({ error: "Indica el mes que estás pagando." }, { status: 400 });
  if (comment.length > 500) return NextResponse.json({ error: "El comentario puede tener máximo 500 caracteres." }, { status: 400 });
  if (!uuidPattern.test(receivableId) || !(file instanceof File) || !file.name.trim() || file.name.length > 180 || !allowedTypes.has(file.type) || file.size < 1 || file.size > maximumSize) return NextResponse.json({ error: "Selecciona un PDF, JPG o PNG de máximo 5 MB." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isValidDocument(bytes, file.type, file.size)) return NextResponse.json({ error: "El contenido no coincide con el tipo de archivo elegido." }, { status: 400 });

  // The user-scoped query enforces the existing finance RLS before any service-role write.
  const { data: receivable } = await supabase.from("accounts_receivable").select("id,property_id,unit_id,status").eq("id", receivableId).maybeSingle();
  if (!receivable || receivable.status !== "active") return NextResponse.json({ error: "Obligación no disponible." }, { status: 404 });

  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/jpeg" ? "jpg" : "png";
  const objectPath = `${receivable.property_id}/finance/${receivable.id}/${id}.${extension}`;
  const { error: uploadError } = await admin.storage.from("private-documents").upload(objectPath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "No se pudo subir el comprobante." }, { status: 500 });
  const { error: insertError } = await admin.from("finance_payment_evidence").insert({ id, property_id: receivable.property_id, unit_id: receivable.unit_id, receivable_id: receivable.id, uploaded_by: user.id, object_path: objectPath, original_name: file.name.trim(), mime_type: file.type, size_bytes: file.size, paid_period: `${paidMonth}-01`, comment: comment || null, declared_amount: Math.round(amount * 100) / 100 });
  if (insertError) {
    await admin.storage.from("private-documents").remove([objectPath]);
    return NextResponse.json({ error: "No se pudo guardar el comprobante." }, { status: 500 });
  }
  return NextResponse.json({ success: true, id });
}
