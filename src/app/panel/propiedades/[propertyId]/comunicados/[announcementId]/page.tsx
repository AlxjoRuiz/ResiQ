import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PublishAnnouncementForm } from "@/components/announcements/announcement-forms";
import { requirePropertyMember } from "@/lib/auth/require-property-member";

type MemberRow = { id: string; profiles: { display_name: string } | { display_name: string }[] | null };

export default async function AnnouncementDetailPage({ params, searchParams }: {
  params: Promise<{ propertyId: string; announcementId: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const { propertyId, announcementId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  const { data: item } = await supabase.from("announcements").select("id,subject,body,status,created_at,published_at")
    .eq("property_id", propertyId).eq("id", announcementId).maybeSingle();
  if (!item) notFound();
  const isAdmin = membership.roles.includes("administrator");
  let recipientNames: string[] = [];
  if (isAdmin) {
    const { data: audience } = await supabase.from("announcement_recipients").select("member_id").eq("property_id", propertyId).eq("announcement_id", announcementId);
    const ids = (audience ?? []).map((row) => row.member_id);
    if (ids.length) {
      const { data: members } = await supabase.from("property_members").select("id,profiles!property_members_user_id_fkey(display_name)").eq("property_id", propertyId).in("id", ids);
      recipientNames = ((members ?? []) as MemberRow[]).map((row) => (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)?.display_name ?? "Miembro");
    }
  }
  const formatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: property.timezone });
  const justPublished = (await searchParams).published === "1";
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 sm:px-10"><Link href={`/panel/propiedades/${propertyId}/comunicados`} className="text-sm text-muted-foreground hover:text-foreground">← Comunicados de {property.name}</Link>{justPublished && <p role="status" className="mt-5 rounded-xl bg-secondary p-4 text-sm text-primary">Comunicado publicado. Los avisos internos están disponibles para los destinatarios.</p>}<article className="mt-6 rounded-2xl border bg-card p-6 sm:p-8"><div className="flex flex-wrap justify-between gap-3"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Comunicado</p><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{item.status === "published" ? "Publicado" : "Borrador"}</span></div><h1 className="mt-3 text-2xl font-semibold tracking-tight">{item.subject}</h1><time dateTime={item.published_at ?? item.created_at} className="mt-2 block text-xs text-muted-foreground">{formatter.format(new Date(item.published_at ?? item.created_at))}</time><p className="mt-6 whitespace-pre-wrap text-sm leading-6">{item.body}</p>{isAdmin && <section className="mt-7 border-t pt-5"><h2 className="text-sm font-semibold">Destinatarios ({recipientNames.length})</h2><p className="mt-2 text-sm text-muted-foreground">{recipientNames.join(", ") || "Sin destinatarios activos"}</p></section>}{isAdmin && item.status === "draft" && <div className="mt-7 flex flex-wrap items-center gap-4 border-t pt-5"><Button asChild variant="outline"><Link href={`/panel/propiedades/${propertyId}/comunicados/${announcementId}/editar`}>Editar borrador</Link></Button><PublishAnnouncementForm propertyId={propertyId} announcementId={announcementId} /></div>}{item.status === "published" && <p className="mt-7 border-t pt-5 text-xs text-muted-foreground">Envío interno. El correo externo se habilitará cuando el dominio esté configurado.</p>}</article></main>;
}
