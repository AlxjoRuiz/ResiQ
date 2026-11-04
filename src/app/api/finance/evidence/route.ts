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
  // Comprobante de una cuota del acuerdo de pago (01/11/2026), en lugar de una deuda.
  const installmentId = String(form.get("installmentId") ?? "");
  const file = form.get("file");
  // Mes que paga (AAAA-MM, obligatorio) y comentario opcional para la administración.
  const paidMonth = String(form.get("paidMonth") ?? "").trim();
  const comment = String(form.get("comment") ?? "").trim();
  // Valor que el residente pagó o abonó a la obligación elegida.
  const amount = Number(form.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) return NextResponse.json({ error: "Escribe el valor que pagaste." }, { status: 400 });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(paidMonth)) return NextResponse.json({ error: "Indica el mes que estás pagando." }, { status: 400 });
  if (comment.length > 500) return NextResponse.json({ error: "El comentario puede tener máximo 500 caracteres." }, { status: 400 });
  if (!(uuidPattern.test(receivableId) || uuidPattern.test(installmentId)) || !(file instanceof File) || !file.name.trim() || file.name.length > 180 || !allowedTypes.has(file.type) || file.size < 1 || file.size > maximumSize) return NextResponse.json({ error: "Selecciona un PDF, JPG o PNG de máximo 5 MB." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isValidDocument(bytes, file.type, file.size)) return NextResponse.json({ error: "El contenido no coincide con el tipo de archivo elegido." }, { status: 400 });

  // The user-scoped queries enforce the existing finance RLS before any service-role write.
  let receivable: { id: string; property_id: string; unit_id: string; status: string } | null = null;
  let installment: string | null = null;
  // Reparto que eligió el residente para una cuota: deudas en orden con el valor de cada una (04/11/2026).
  let planned: { receivable_id: string; amount: number }[] | null = null;
  if (uuidPattern.test(installmentId)) {
    // Cuota de un acuerdo vigente del apartamento. Desde el 04/11/2026 el residente elige una o varias deudas a
    // las que aplica el pago de la cuota (cada una hasta su saldo; la última, como abono); el admin lo revisa al
    // registrar. Si no eligió, queda en la deuda más antigua.
    const { data: row } = await supabase.from("payment_agreement_installments").select("id,property_id,agreement_id").eq("id", installmentId).maybeSingle();
    const { data: agreement } = row ? await supabase.from("payment_agreements").select("id,unit_id,status").eq("property_id", row.property_id).eq("id", row.agreement_id).maybeSingle() : { data: null };
    if (!row || !agreement || agreement.status !== "active") return NextResponse.json({ error: "Cuota no disponible." }, { status: 404 });
    const { data: oldest } = await supabase.from("accounts_receivable").select("id,property_id,unit_id,status").eq("property_id", row.property_id).eq("unit_id", agreement.unit_id).eq("status", "active")
      .order("due_on", { ascending: true }).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!oldest) return NextResponse.json({ error: "Cuota no disponible." }, { status: 404 });
    receivable = oldest; installment = row.id;
    let parts: { id: string; amount: number }[] = [];
    try { const raw: unknown = JSON.parse(String(form.get("allocations") ?? "[]")); parts = Array.isArray(raw) ? raw.map((item) => ({ id: String(item?.id ?? ""), amount: Math.round(Number(item?.amount) * 100) / 100 })) : []; } catch { parts = []; }
    if (parts.length) {
      const total = parts.reduce((sum, item) => sum + item.amount, 0);
      if (parts.length > 50 || new Set(parts.map((item) => item.id)).size !== parts.length || parts.some((item) => !uuidPattern.test(item.id) || !(item.amount > 0)) || total > Math.round(amount * 100) / 100 + 0.01) return NextResponse.json({ error: "Revisa las deudas que pagas con esta cuota." }, { status: 400 });
      const { data: chosen } = await supabase.from("accounts_receivable").select("id,property_id,unit_id,status").in("id", parts.map((item) => item.id));
      const valid = (chosen ?? []).filter((item) => item.status === "active" && item.property_id === row.property_id && item.unit_id === agreement.unit_id);
      if (valid.length !== parts.length) return NextResponse.json({ error: "Elige deudas de tu apartamento." }, { status: 400 });
      receivable = valid.find((item) => item.id === parts[0].id) ?? oldest;
      planned = parts.map((item) => ({ receivable_id: item.id, amount: item.amount }));
    }
  } else {
    const { data: row } = await supabase.from("accounts_receivable").select("id,property_id,unit_id,status").eq("id", receivableId).maybeSingle();
    receivable = row;
  }
  if (!receivable || receivable.status !== "active") return NextResponse.json({ error: "Obligación no disponible." }, { status: 404 });

  const admin = createAdminClient();
  // Un solo comprobante en revisión por deuda o por cuota (31/10/2026): evita enviar dos veces el mismo pago.
  // Si la administración lo registra o anula ese pago, se puede enviar otro.
  const pending = admin.from("finance_payment_evidence").select("id", { count: "exact", head: true }).is("payment_id", null).is("payment_voided_at", null);
  const { count: inReview } = installment ? await pending.eq("agreement_installment_id", installment) : await pending.eq("receivable_id", receivable.id).is("agreement_installment_id", null);
  if (inReview) return NextResponse.json({ error: installment ? "Ya enviaste un comprobante para esta cuota y está en revisión. Espera a que la administración lo registre." : "Ya enviaste un comprobante para esta deuda y está en revisión. Espera a que la administración lo registre." }, { status: 409 });
  const id = crypto.randomUUID();
  const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/jpeg" ? "jpg" : "png";
  const objectPath = `${receivable.property_id}/finance/${receivable.id}/${id}.${extension}`;
  const { error: uploadError } = await admin.storage.from("private-documents").upload(objectPath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "No se pudo subir el comprobante." }, { status: 500 });
  const { error: insertError } = await admin.from("finance_payment_evidence").insert({ id, property_id: receivable.property_id, unit_id: receivable.unit_id, receivable_id: receivable.id, uploaded_by: user.id, object_path: objectPath, original_name: file.name.trim(), mime_type: file.type, size_bytes: file.size, paid_period: `${paidMonth}-01`, comment: comment || null, declared_amount: Math.round(amount * 100) / 100, agreement_installment_id: installment, planned_allocations: planned });
  if (insertError) {
    await admin.storage.from("private-documents").remove([objectPath]);
    return NextResponse.json({ error: "No se pudo guardar el comprobante." }, { status: 500 });
  }
  return NextResponse.json({ success: true, id });
}
