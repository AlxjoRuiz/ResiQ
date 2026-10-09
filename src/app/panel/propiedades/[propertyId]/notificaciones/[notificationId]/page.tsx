import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { noticeCategoryLabel, noticeTargetPath } from "@/lib/notifications/constants";
import { markNotificationRead } from "../actions";

export default async function NotificationDetailPage({ params }: { params: Promise<{ propertyId: string; notificationId: string }> }) {
  const { propertyId, notificationId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  const { data: notice } = await supabase.from("notifications")
    .select("id,subject,body,target_type,target_id,read_at,occurred_at")
    .eq("property_id", propertyId)
    .eq("recipient_member_id", membership.id)
    .eq("id", notificationId)
    .maybeSingle();
  if (!notice) notFound();
  const targetPath = noticeTargetPath(propertyId, notice.target_type, notice.target_id);
  const formatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: property.timezone });
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 sm:px-10"><Link href={`/panel/propiedades/${propertyId}/notificaciones`} className="text-sm text-muted-foreground hover:text-foreground">← Notificaciones de {property.name}</Link><article className="mt-6 rounded-2xl border bg-card p-6 sm:p-8"><div className="flex flex-wrap justify-between gap-3"><p className="text-xs font-semibold tracking-wider text-primary uppercase">{noticeCategoryLabel(notice.target_type)}</p><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{notice.read_at ? "Leída" : "Sin leer"}</span></div><h1 className="mt-3 text-2xl font-semibold tracking-tight">{notice.subject}</h1><time dateTime={notice.occurred_at} className="mt-2 block text-xs text-muted-foreground">{formatter.format(new Date(notice.occurred_at))}</time><p className="mt-6 whitespace-pre-wrap text-sm leading-6">{notice.body}</p><div className="mt-7 flex flex-wrap gap-3">{!notice.read_at && <form action={markNotificationRead.bind(null, propertyId, notice.id)}><Button type="submit" variant="outline">Marcar como leída</Button></form>}{targetPath && <Button asChild><Link href={targetPath}>Abrir sección relacionada</Link></Button>}</div></article></main>;
}
