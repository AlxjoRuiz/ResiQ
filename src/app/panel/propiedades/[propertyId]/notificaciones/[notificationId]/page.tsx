import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { noticeCategoryLabel } from "@/lib/notifications/constants";
import { markNotificationRead } from "../actions";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function NotificationDetailPage({ params }: { params: Promise<{ propertyId: string; notificationId: string }> }) {
  const { propertyId, notificationId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  const { data: notice } = await supabase.from("notifications")
    .select("id,subject,body,target_type,target_id,read_at,occurred_at")
    .eq("property_id", propertyId).eq("recipient_member_id", membership.id).eq("id", notificationId).maybeSingle();
  if (!notice) notFound();

  const dateTime = new Intl.DateTimeFormat("es-CO", { dateStyle: "full", timeStyle: "short", timeZone: "America/Bogota" });
  const dateOnly = new Intl.DateTimeFormat("es-CO", { dateStyle: "full", timeZone: "America/Bogota" });
  const details: { label: string; value: string }[] = [];
  const addTime = (label: string, value: string | null | undefined) => { if (value) details.push({ label, value: dateTime.format(new Date(value)) }); };
  const addDate = (label: string, value: string | null | undefined) => { if (value) details.push({ label, value: dateOnly.format(new Date(`${value}T12:00:00Z`)) }); };
  const addText = (label: string, value: string | number | null | undefined) => { if (value !== null && value !== undefined && value !== "") details.push({ label, value: String(value) }); };

  // Estas consultas son de solo lectura y respetan las políticas de acceso de cada tabla.
  if (notice.target_id && uuidPattern.test(notice.target_id)) {
    const targetId = notice.target_id;
    switch (notice.target_type) {
      case "reservation": {
        const { data } = await supabase.from("reservations").select("starts_at,ends_at,attendee_count,purpose,review_message,decision_reason,amenities(name)").eq("property_id", propertyId).eq("id", targetId).maybeSingle();
        if (data) {
          const amenity = Array.isArray(data.amenities) ? data.amenities[0] : data.amenities;
          addText("Zona", amenity?.name); addTime("Inicio de la reserva", data.starts_at); addTime("Fin de la reserva", data.ends_at);
          addText("Personas", data.attendee_count); addText("Motivo de la reserva", data.purpose);
          addText("Respuesta de Administración", data.review_message); addText("Motivo de la decisión o cancelación", data.decision_reason);
        }
        break;
      }
      case "visitor": {
        const { data } = await supabase.from("visitors").select("visitor_name,scheduled_start,scheduled_end,people_count").eq("property_id", propertyId).eq("id", targetId).maybeSingle();
        if (data) { addText("Visitante", data.visitor_name); addTime("Inicio autorizado", data.scheduled_start); addTime("Fin autorizado", data.scheduled_end); addText("Personas", data.people_count); }
        break;
      }
      case "package": {
        const { data } = await supabase.from("packages").select("description,received_at,delivered_at").eq("property_id", propertyId).eq("id", targetId).maybeSingle();
        if (data) { addText("Descripción", data.description); addTime("Recibido en portería", data.received_at); addTime("Entregado", data.delivered_at); }
        break;
      }
      case "pqrs": {
        const { data } = await supabase.from("pqrs").select("subject,created_at,closed_at").eq("property_id", propertyId).eq("id", targetId).maybeSingle();
        if (data) { addText("Asunto", data.subject); addTime("Solicitud creada", data.created_at); addTime("Solicitud cerrada", data.closed_at); }
        break;
      }
      case "attention_call": {
        const { data } = await supabase.from("attention_calls").select("reason,issued_at,closed_at").eq("property_id", propertyId).eq("id", targetId).maybeSingle();
        if (data) { addText("Motivo", data.reason); addTime("Fecha del llamado", data.issued_at); addTime("Cerrado", data.closed_at); }
        break;
      }
      case "assembly": {
        const { data } = await supabase.from("assemblies").select("title,starts_at,location").eq("property_id", propertyId).eq("id", targetId).maybeSingle();
        if (data) { addText("Asamblea", data.title); addTime("Fecha y hora", data.starts_at); addText("Lugar", data.location); }
        break;
      }
      case "announcement": {
        const { data } = await supabase.from("announcements").select("subject,published_at").eq("property_id", propertyId).eq("id", targetId).maybeSingle();
        if (data) { addText("Asunto", data.subject); addTime("Publicado", data.published_at); }
        break;
      }
      case "receivable": {
        const { data } = await supabase.from("accounts_receivable").select("concept,issued_on,due_on").eq("property_id", propertyId).eq("id", targetId).maybeSingle();
        if (data) { addText("Concepto", data.concept); addDate("Emitida", data.issued_on); addDate("Vencimiento", data.due_on); }
        break;
      }
      case "payment": {
        const { data } = await supabase.from("payments").select("paid_on,amount,currency").eq("property_id", propertyId).eq("id", targetId).maybeSingle();
        if (data) { addDate("Fecha del pago", data.paid_on); addText("Valor", new Intl.NumberFormat("es-CO", { style: "currency", currency: data.currency }).format(data.amount)); }
        break;
      }
    }
  }

  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 sm:px-10">
    <Link href={`/panel/propiedades/${propertyId}/notificaciones`} className="text-sm text-muted-foreground hover:text-foreground">← Volver a Notificaciones</Link>
    <article className="mt-6 rounded-2xl border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap justify-between gap-3"><p className="text-xs font-semibold tracking-wider text-primary uppercase">{noticeCategoryLabel(notice.target_type)}</p><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{notice.read_at ? "Leída" : "Sin leer"}</span></div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{notice.subject}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Aviso recibido el <time dateTime={notice.occurred_at}>{dateTime.format(new Date(notice.occurred_at))}</time> · hora de Colombia</p>
      <p className="mt-6 whitespace-pre-wrap text-sm leading-6">{notice.body}</p>
      {details.length > 0 && <section aria-label="Detalles del aviso" className="mt-6 rounded-xl border bg-muted/30 p-4"><h2 className="text-sm font-semibold">Detalles</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2">{details.map(({ label, value }) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-medium">{value}</dd></div>)}</dl></section>}
      {!notice.read_at && <form action={markNotificationRead.bind(null, propertyId, notice.id)} className="mt-7"><Button type="submit" variant="outline">Marcar como leída</Button></form>}
    </article>
  </main>;
}
