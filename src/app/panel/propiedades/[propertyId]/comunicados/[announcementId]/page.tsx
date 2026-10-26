import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PublishAnnouncementForm } from "@/components/announcements/announcement-forms";
import { AnnouncementFileCard } from "@/components/announcements/announcement-file-card";
import { requirePropertyMember } from "@/lib/auth/require-property-member";

export default async function AnnouncementDetailPage({ params, searchParams }: {
  params: Promise<{ propertyId: string; announcementId: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const { propertyId, announcementId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  const { data: item } = await supabase.from("announcements").select("id,subject,body,status,created_at,published_at")
    .eq("property_id", propertyId).eq("id", announcementId).maybeSingle();
  if (!item) notFound();
  const { data: attachments } = await supabase.from("documents").select("id,original_name,mime_type,size_bytes")
    .eq("property_id", propertyId).eq("announcement_id", announcementId).eq("status", "available").order("created_at");
  const isAdmin = membership.roles.includes("administrator");
  // Administración ve solo el total de cuentas que recibieron el comunicado.
  let recipientCount = 0;
  if (isAdmin) {
    const { count } = await supabase.from("announcement_recipients").select("member_id", { count: "exact", head: true }).eq("property_id", propertyId).eq("announcement_id", announcementId);
    recipientCount = count ?? 0;
  }
  const formatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: property.timezone });
  const justPublished = (await searchParams).published === "1";
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 sm:px-10"><Link href={`/panel/propiedades/${propertyId}/comunicados`} className="text-sm text-muted-foreground hover:text-foreground">← Volver a Comunicados</Link>{justPublished && <p role="status" className="mt-5 rounded-xl bg-secondary p-4 text-sm text-primary">Comunicado publicado. Los avisos internos están disponibles para los destinatarios.</p>}<article className="mt-6 rounded-2xl border bg-card p-6 sm:p-8"><div className="flex flex-wrap justify-between gap-3"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Comunicado</p><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{item.status === "published" ? "Publicado" : "Borrador"}</span></div><h1 className="mt-3 text-2xl font-semibold tracking-tight">{item.subject}</h1><time dateTime={item.published_at ?? item.created_at} className="mt-2 block text-xs text-muted-foreground">{formatter.format(new Date(item.published_at ?? item.created_at))}</time><p className="mt-6 whitespace-pre-wrap text-sm leading-6">{item.body}</p>{!!attachments?.length && <div className="mt-6 border-t pt-4"><p className="text-sm font-semibold">Archivos adjuntos</p><ul className="mt-3 grid gap-2">{attachments.map((document) => <li key={document.id}><AnnouncementFileCard document={document} /></li>)}</ul></div>}{isAdmin && <section className="mt-7 border-t pt-5"><p className="text-sm"><span className="font-semibold">{item.status === "published" ? "Enviado a" : "Destinatarios:"}</span> {recipientCount} {recipientCount === 1 ? "cuenta" : "cuentas"}</p></section>}{isAdmin && item.status === "draft" && <div className="mt-7 flex flex-wrap items-center gap-4 border-t pt-5"><Button asChild variant="outline"><Link href={`/panel/propiedades/${propertyId}/comunicados/${announcementId}/editar`}>Editar borrador</Link></Button><PublishAnnouncementForm propertyId={propertyId} announcementId={announcementId} /></div>}{item.status === "published" && <p className="mt-7 border-t pt-5 text-xs text-muted-foreground">Envío interno. El correo externo se habilitará cuando el dominio esté configurado.</p>}</article></main>;
}
