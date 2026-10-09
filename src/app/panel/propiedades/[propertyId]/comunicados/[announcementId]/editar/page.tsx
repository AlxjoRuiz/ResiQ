import Link from "next/link";
import { notFound } from "next/navigation";
import { AnnouncementDraftForm, type AnnouncementRecipient } from "@/components/announcements/announcement-forms";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";

type MemberRow = { id: string; roles: string[]; profiles: { display_name: string } | { display_name: string }[] | null };

export default async function EditAnnouncementPage({ params }: { params: Promise<{ propertyId: string; announcementId: string }> }) {
  const { propertyId, announcementId } = await params;
  const { supabase, property } = await requirePropertyAdmin(propertyId);
  const [{ data: draft }, { data: audience }, { data: memberData, error }] = await Promise.all([
    supabase.from("announcements").select("id,subject,body,status").eq("property_id", propertyId).eq("id", announcementId).maybeSingle(),
    supabase.from("announcement_recipients").select("member_id").eq("property_id", propertyId).eq("announcement_id", announcementId),
    supabase.from("property_members").select("id,roles,profiles(display_name)").eq("property_id", propertyId).eq("status", "active").order("joined_at"),
  ]);
  if (!draft || draft.status !== "draft") notFound();
  if (error) throw new Error("No se pudo cargar el directorio de miembros.");
  const recipients: AnnouncementRecipient[] = ((memberData ?? []) as MemberRow[]).map((row) => ({
    id: row.id, name: (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)?.display_name ?? "Miembro", roles: row.roles,
  }));
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 sm:px-10"><Link href={`/panel/propiedades/${propertyId}/comunicados/${announcementId}`} className="text-sm text-muted-foreground hover:text-foreground">← Borrador de {property.name}</Link><section className="mt-6 rounded-2xl border bg-card p-6 sm:p-8"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Administración</p><h1 className="mt-2 mb-7 text-3xl font-semibold tracking-tight">Editar borrador</h1><AnnouncementDraftForm propertyId={propertyId} recipients={recipients} draft={{ id: draft.id, subject: draft.subject, body: draft.body, recipientIds: (audience ?? []).map((row) => row.member_id) }} /></section></main>;
}
