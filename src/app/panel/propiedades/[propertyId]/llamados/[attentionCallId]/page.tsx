import Link from "next/link";
import { notFound } from "next/navigation";
import { AttentionCallAttachmentUpload, AttentionCallStatusForm, MarkAttentionCallRead } from "@/components/attention-calls/attention-call-forms";
import { attentionCategoryLabel, attentionStatusLabel } from "@/lib/attention-calls/constants";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { dateTimeFormatter as makeDateTimeFormatter } from "@/lib/time-zone";

type UnitRelation = { code: string; buildings: { name: string } | { name: string }[] | null } | { code: string; buildings: { name: string } | { name: string }[] | null }[] | null;
type Recipient = { member_id: string; read_at: string | null };
function unitLabel(units: UnitRelation) { const unit = Array.isArray(units) ? units[0] : units; const building = Array.isArray(unit?.buildings) ? unit.buildings[0] : unit?.buildings; return [building?.name, unit?.code].filter(Boolean).join(" · ") || "Apartamento"; }
type NamedMember = { id: string; profiles: { display_name: string } | { display_name: string }[] | null };
function recipientName(member: NamedMember | undefined) { const profile = Array.isArray(member?.profiles) ? member.profiles[0] : member?.profiles; return profile?.display_name ?? "Miembro"; }
const eventLabels: Record<string, string> = { attention_call_created: "Llamado creado", attention_call_notified: "Correos aceptados por el proveedor", attention_call_review_started: "Revisión iniciada", attention_call_read: "Destinatario lo consultó", attention_call_closed: "Llamado cerrado", attention_call_attachment_added: "Evidencia añadida" };

export default async function AttentionCallDetailPage({ params, searchParams }: { params: Promise<{ propertyId: string; attentionCallId: string }>; searchParams: Promise<{ created?: string }> }) {
  const { propertyId, attentionCallId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  const dateFormatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: property.timezone });
  const dateTimeFormatter = makeDateTimeFormatter(property.timezone);
  if (!membership.roles.includes("administrator") && !membership.roles.includes("member")) notFound();
  const [{ data: visibleCalls, error: callsError }, { data: documents }, { data: events }] = await Promise.all([
    supabase.from("attention_calls").select("id,category,reason,status,issued_at,units(code,buildings(name)),attention_call_recipients(member_id,read_at)").eq("property_id", propertyId).order("issued_at", { ascending: false }),
    supabase.from("documents").select("id,original_name,mime_type,size_bytes,status,created_at").eq("property_id", propertyId).eq("attention_call_id", attentionCallId).eq("status", "available").order("created_at"),
    supabase.from("activity_events").select("id,event_type,previous_state,new_state,description,occurred_at").eq("property_id", propertyId).eq("attention_call_id", attentionCallId).order("occurred_at", { ascending: false }),
  ]);
  if (callsError) throw new Error("No pudimos cargar el listado de llamados.");
  const visibleCall = visibleCalls?.find((call) => call.id === attentionCallId);
  if (!visibleCall) notFound();
  const { data: details, error: detailsError } = await supabase.from("attention_calls")
    .select("description,close_note")
    .eq("property_id", propertyId)
    .eq("id", attentionCallId)
    .maybeSingle();
  if (detailsError || !details) throw new Error("No pudimos cargar el contenido del llamado.");
  const item = { ...visibleCall, ...details };
  const isAdmin = membership.roles.includes("administrator"), isClosed = item.status === "closed";
  const recipients = (item.attention_call_recipients ?? []) as Recipient[];
  const { data: memberData } = recipients.length
    ? await supabase.from("property_members").select("id,profiles!property_members_user_id_fkey(display_name)").eq("property_id", propertyId).in("id", recipients.map((recipient) => recipient.member_id))
    : { data: [] };
  const memberNames = new Map(((memberData ?? []) as NamedMember[]).map((member) => [member.id, member]));
  const ownRecipient = recipients.find((recipient) => recipient.member_id === membership.id);
  const created = (await searchParams).created === "1";
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10">{ownRecipient && <MarkAttentionCallRead propertyId={propertyId} attentionCallId={attentionCallId} alreadyRead={Boolean(ownRecipient.read_at)} />}<Link href={`/panel/propiedades/${propertyId}/llamados`} className="text-sm text-muted-foreground hover:text-foreground">← Volver a Llamados</Link>{created && <p role="status" className="mt-5 rounded-xl bg-secondary p-4 text-sm font-medium text-primary">El llamado fue creado. Las notificaciones están en proceso y ya puedes adjuntar evidencias.</p>}<header className="mt-6 rounded-2xl border bg-card p-6"><div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">{attentionCategoryLabel(item.category)} · {unitLabel(item.units as UnitRelation)}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{item.reason}</h1><p className="mt-2 text-xs text-muted-foreground">Emitido el {dateFormatter.format(new Date(item.issued_at))}</p></div><span className="h-fit rounded-full bg-secondary px-3 py-1 text-sm font-medium">{attentionStatusLabel(item.status)}</span></div><p className="mt-6 whitespace-pre-wrap text-sm leading-6">{item.description}</p>{item.close_note && <div className="mt-6 rounded-xl bg-secondary p-4"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Nota de cierre</p><p className="mt-2 whitespace-pre-wrap text-sm">{item.close_note}</p></div>}{isAdmin && <div className="mt-6 border-t pt-5"><AttentionCallStatusForm propertyId={propertyId} attentionCallId={attentionCallId} currentStatus={item.status} />{item.status === "created" && <p className="text-sm text-muted-foreground">El siguiente paso se habilita cuando el proveedor acepte todos los correos.</p>}</div>}</header><div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]"><div className="grid gap-6"><section className="rounded-2xl border bg-card p-6"><h2 className="text-xl font-semibold">Destinatarios</h2><div className="mt-4 grid gap-2">{recipients.map((recipient) => <div key={recipient.member_id} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"><span>{recipientName(memberNames.get(recipient.member_id))}</span><span className="text-xs text-muted-foreground">{recipient.read_at ? `Leído ${dateTimeFormatter.format(new Date(recipient.read_at))}` : "Sin leer"}</span></div>)}</div></section><section className="rounded-2xl border bg-card p-6"><h2 className="text-xl font-semibold">Evidencias</h2><div className="mt-4 grid gap-2">{(documents ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No hay evidencias adjuntas.</p> : documents?.map((document) => <a key={document.id} href={`/api/attention-calls/documents/${document.id}`} className="rounded-lg border px-4 py-3 text-sm hover:bg-muted">{document.original_name} <span className="text-muted-foreground">· {(Number(document.size_bytes) / 1024).toFixed(0)} KB</span></a>)}</div>{isAdmin && !isClosed && <div className="mt-5"><AttentionCallAttachmentUpload attentionCallId={attentionCallId} availableSlots={Math.max(0, 5 - (documents?.length ?? 0))} /></div>}</section></div><aside className="rounded-2xl border bg-card p-6"><h2 className="text-xl font-semibold">Historial</h2><ol className="mt-5 grid gap-4">{(events ?? []).map((event) => <li key={event.id} className="border-l-2 border-primary/30 pl-4"><p className="text-sm font-medium">{eventLabels[event.event_type] ?? event.description}</p><time className="mt-1 block text-xs text-muted-foreground">{dateTimeFormatter.format(new Date(event.occurred_at))}</time></li>)}</ol></aside></div></main>;
}
