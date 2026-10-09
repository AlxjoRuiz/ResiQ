import Link from "next/link";
import { AnnouncementDraftForm, type AnnouncementRecipient } from "@/components/announcements/announcement-forms";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";

type MemberRow = { id: string; roles: string[]; profiles: { display_name: string } | { display_name: string }[] | null };

export default async function NewAnnouncementPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase, property } = await requirePropertyAdmin(propertyId);
  const { data, error } = await supabase.from("property_members")
    .select("id,roles,profiles(display_name)").eq("property_id", propertyId).eq("status", "active").order("joined_at");
  if (error) throw new Error("No se pudo cargar el directorio de miembros.");
  const recipients: AnnouncementRecipient[] = ((data ?? []) as MemberRow[]).map((row) => ({
    id: row.id, name: (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)?.display_name ?? "Miembro", roles: row.roles,
  }));
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 sm:px-10"><Link href={`/panel/propiedades/${propertyId}/comunicados`} className="text-sm text-muted-foreground hover:text-foreground">← Comunicados de {property.name}</Link><section className="mt-6 rounded-2xl border bg-card p-6 sm:p-8"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Administración</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Nuevo comunicado</h1><p className="mt-2 mb-7 text-sm text-muted-foreground">Primero guarda un borrador. Podrás revisar y cambiar el mensaje y sus destinatarios antes de publicarlo. Por ahora el aviso será interno.</p><AnnouncementDraftForm propertyId={propertyId} recipients={recipients} /></section></main>;
}
