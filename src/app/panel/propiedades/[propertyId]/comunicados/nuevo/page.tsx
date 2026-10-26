import Link from "next/link";
import { CreateAnnouncementForm } from "@/components/announcements/announcement-forms";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";

export default async function NewAnnouncementPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  await requirePropertyAdmin(propertyId);
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 sm:px-10"><Link href={`/panel/propiedades/${propertyId}/comunicados`} className="text-sm text-muted-foreground hover:text-foreground">← Volver a Comunicados</Link><section className="mt-6 rounded-2xl border bg-card p-6 sm:p-8"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Administración</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Nuevo comunicado</h1><p className="mt-2 mb-7 text-sm text-muted-foreground">Escribe el mensaje y adjunta archivos si los necesitas. Se publica al enviarlo y llega a toda la comunidad. Por ahora el aviso será interno.</p><CreateAnnouncementForm propertyId={propertyId} /></section></main>;
}
