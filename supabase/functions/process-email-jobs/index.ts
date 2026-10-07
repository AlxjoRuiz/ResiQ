import { createClient } from "npm:@supabase/supabase-js@2";

type EmailJob = { id: string; recipient_email: string; template_key: string; template_data: { subject?: string; pqrs_id?: string; package_id?: string; visitor_id?: string; reservation_id?: string; attention_call_id?: string; assembly_id?: string; property_id?: string; recipient_name?: string; visitor_name?: string; carrier?: string; amenity_name?: string; scheduled_start?: string; starts_at?: string; ends_at?: string; status?: string; timezone?: string; unit_id?: string; unit_label?: string; concept?: string; reason?: string; category?: string; issued_on?: string; location?: string; title?: string; reminder?: string; amount?: number; currency?: string; due_on?: string; paid_on?: string; overdue_days?: number }; dedupe_key: string };
const jsonHeaders = { "content-type": "application/json" };

function emailContent(job: EmailJob, appUrl: string) {
  if (job.template_key.startsWith("assembly_")) {
    const headings: Record<string, string> = { assembly_published: "Nueva convocatoria de asamblea", assembly_reminder: "Recordatorio de asamblea", assembly_updated: "Cambio en una asamblea", assembly_cancelled: "Asamblea cancelada" };
    const heading = headings[job.template_key] ?? "Actualización de asamblea";
    const details = [job.template_data.title ? `Asamblea: ${job.template_data.title}` : "", job.template_data.starts_at ? `Fecha: ${new Date(job.template_data.starts_at).toLocaleString("es-CO", { timeZone: "America/Bogota" })}` : "", job.template_data.location ? `Lugar: ${job.template_data.location}` : ""].filter(Boolean).join("\n");
    const path = job.template_data.property_id && job.template_data.assembly_id ? `/panel/propiedades/${job.template_data.property_id}/asambleas/${job.template_data.assembly_id}` : "/panel";
    const escaped = details.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
    return { subject: heading, text: `${heading}\n\n${details}\n\nConsulta el detalle en ${appUrl}${path}`, html: `<h1>${heading}</h1><p>${escaped.replace(/\n/g, "<br>")}</p><p><a href="${appUrl}${path}">Ver en ResiQ</a></p>` };
  }
  if (job.template_key === "attention_call_created") {
    const heading = "Nuevo llamado de atención en ResiQ";
    const details = [job.template_data.reason ? `Motivo: ${job.template_data.reason}` : "", job.template_data.issued_on ? `Fecha: ${job.template_data.issued_on}` : ""].filter(Boolean).join("\n");
    const path = job.template_data.property_id && job.template_data.attention_call_id ? `/panel/propiedades/${job.template_data.property_id}/llamados/${job.template_data.attention_call_id}` : "/panel";
    const escaped = details.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
    return { subject: heading, text: `${heading}\n\n${details}\n\nConsulta el detalle en ${appUrl}${path}`, html: `<h1>${heading}</h1><p>${escaped.replace(/\n/g, "<br>")}</p><p><a href="${appUrl}${path}">Ver en ResiQ</a></p>` };
  }
  if (job.template_key.startsWith("visit_")) {
    const headings: Record<string, string> = { visit_requested: "Solicitud de visita en ResiQ", visit_rejected: "Visita rechazada en ResiQ", visit_authorized: "Visita aceptada en ResiQ", visit_entered: "Tu visita ingresó", visit_exited: "Tu visita salió", visit_cancelled: "Visita cancelada" };
    const heading = headings[job.template_key] ?? "Actualización de visita";
    const details = [`Visitante: ${job.template_data.visitor_name ?? "Sin nombre"}`, job.template_data.scheduled_start ? `Horario: ${new Date(job.template_data.scheduled_start).toLocaleString("es-CO")}` : ""].filter(Boolean).join("\n");
    const path = job.template_data.property_id && job.template_data.visitor_id ? `/panel/propiedades/${job.template_data.property_id}/visitas/${job.template_data.visitor_id}` : "/panel";
    const escaped = details.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
    return { subject: heading, text: `${heading}\n\n${details}\n\nConsulta el detalle en ${appUrl}${path}`, html: `<h1>${heading}</h1><p>${escaped.replace(/\n/g, "<br>")}</p><p><a href="${appUrl}${path}">Ver en ResiQ</a></p>` };
  }
  if (job.template_key.startsWith("reservation_")) {
    const headings: Record<string, string> = { reservation_created: "Solicitud de reserva recibida", reservation_approved: "Reserva aprobada", reservation_rejected: "Reserva rechazada", reservation_cancelled: "Reserva cancelada", reservation_expired: "Solicitud de reserva vencida" };
    const heading = headings[job.template_key] ?? "Actualización de reserva";
    const timeZone = job.template_data.timezone ?? "America/Bogota";
    const details = [job.template_data.amenity_name ? `Zona: ${job.template_data.amenity_name}` : "", job.template_data.starts_at ? `Inicio: ${new Date(job.template_data.starts_at).toLocaleString("es-CO", { timeZone })}` : "", job.template_data.ends_at ? `Fin: ${new Date(job.template_data.ends_at).toLocaleString("es-CO", { timeZone })}` : ""].filter(Boolean).join("\n");
    const path = job.template_data.property_id ? `/panel/propiedades/${job.template_data.property_id}/reservas` : "/panel";
    const escaped = details.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
    return { subject: heading, text: `${heading}\n\n${details}\n\nConsulta el detalle en ${appUrl}${path}`, html: `<h1>${heading}</h1><p>${escaped.replace(/\n/g, "<br>")}</p><p><a href="${appUrl}${path}">Ver en ResiQ</a></p>` };
  }
  if (["receivable_created", "receivable_voided", "payment_recorded", "payment_voided", "delinquency_notice"].includes(job.template_key)) {
    const headings: Record<string, string> = { receivable_created: "Cartera actualizada en ResiQ", receivable_voided: "Obligación anulada", payment_recorded: "Pago registrado en ResiQ", payment_voided: "Pago anulado", delinquency_notice: "Aviso de mora en ResiQ" };
    const heading = headings[job.template_key] ?? "Actualización de cartera";
    const amount = typeof job.template_data.amount === "number" ? new Intl.NumberFormat("es-CO", { style: "currency", currency: job.template_data.currency ?? "COP" }).format(job.template_data.amount) : "";
    const details = [job.template_data.unit_label ? `Apartamento: ${job.template_data.unit_label}` : "", job.template_data.concept ? `Concepto: ${job.template_data.concept}` : "", amount ? `Valor: ${amount}` : "", job.template_data.due_on ? `Vencimiento: ${job.template_data.due_on}` : "", job.template_data.paid_on ? `Fecha de pago: ${job.template_data.paid_on}` : ""].filter(Boolean).join("\n");
    const path = job.template_data.property_id && job.template_data.unit_id ? `/panel/propiedades/${job.template_data.property_id}/cartera/${job.template_data.unit_id}` : "/panel";
    const escaped = details.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
    return { subject: heading, text: `${heading}\n\n${details}\n\nConsulta el detalle en ${appUrl}${path}`, html: `<h1>${heading}</h1><p>${escaped.replace(/\n/g, "<br>")}</p><p><a href="${appUrl}${path}">Ver en ResiQ</a></p>` };
  }
  if (job.template_key === "package_received") {
    const heading = "Paquete recibido en ResiQ";
    const details = [`Paquete para ${job.template_data.recipient_name ?? "ti"}`, job.template_data.carrier ? `Transportadora: ${job.template_data.carrier}` : ""].filter(Boolean).join("\n");
    const path = job.template_data.property_id && job.template_data.package_id ? `/panel/propiedades/${job.template_data.property_id}/paquetes/${job.template_data.package_id}` : "/panel";
    const escaped = details.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
    return { subject: heading, text: `${heading}\n\n${details}\n\nConsulta el detalle en ${appUrl}${path}`, html: `<h1>${heading}</h1><p>${escaped.replace(/\n/g, "<br>")}</p><p><a href="${appUrl}${path}">Ver en ResiQ</a></p>` };
  }
  const isCreated = job.template_key === "pqrs_created";
  const heading = isCreated ? "Nueva PQRS en ResiQ" : "Actualización de tu PQRS";
  const subject = job.template_data.subject ?? "PQRS";
  const path = job.template_data.property_id && job.template_data.pqrs_id ? `/panel/propiedades/${job.template_data.property_id}/pqrs/${job.template_data.pqrs_id}` : "/panel";
  const text = `${heading}\n\n${subject}\n\nConsulta el detalle en ${appUrl}${path}`;
  const html = `<h1>${heading}</h1><p>${subject.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!)}</p><p><a href="${appUrl}${path}">Ver en ResiQ</a></p>`;
  return { subject: heading, text, html };
}

export default {
  async fetch(request: Request): Promise<Response> {
  const workerSecret = Deno.env.get("EMAIL_WORKER_SECRET");
  if (!workerSecret || request.headers.get("x-worker-secret") !== workerSecret) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: jsonHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  const appUrl = (Deno.env.get("APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  if (!supabaseUrl || !serviceKey || !resendKey || !from) return new Response(JSON.stringify({ error: "missing_configuration" }), { status: 500, headers: jsonHeaders });
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const workerName = crypto.randomUUID();
  const { data, error } = await supabase.rpc("claim_email_jobs", { worker_name: workerName, batch_size: 10 });
  if (error) return new Response(JSON.stringify({ error: "queue_unavailable" }), { status: 500, headers: jsonHeaders });
  const results = [];
  for (const job of (data ?? []) as EmailJob[]) {
    let content = { subject: "", html: "", text: "" };
    try {
      const authorization = await supabase.rpc("authorize_email_job", { target_job_id: job.id, worker_name: workerName });
      if (authorization.error) throw new Error("email_authorization_unavailable");
      if (authorization.data !== true) { results.push({ id: job.id, status: "cancelled" }); continue; }
      content = emailContent(job, appUrl);
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json", "idempotency-key": job.dedupe_key }, body: JSON.stringify({ from, to: [job.recipient_email], subject: content.subject, html: content.html, text: content.text }) });
      const responseBody = await response.json() as { id?: string; message?: string; name?: string };
      if (!response.ok || !responseBody.id) throw new Error(responseBody.message ?? responseBody.name ?? `http_${response.status}`);
      await supabase.rpc("complete_email_job", { target_job_id: job.id, provider_id: responseBody.id, target_subject: content.subject, target_body: content.text });
      results.push({ id: job.id, status: "accepted" });
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "unknown_error";
      await supabase.rpc("fail_email_job", { target_job_id: job.id, error_code: "resend_error", error_message: message, target_subject: content.subject, target_body: content.text });
      results.push({ id: job.id, status: "failed" });
    }
  }
  return new Response(JSON.stringify({ processed: results.length, results }), { headers: jsonHeaders });
  },
};
