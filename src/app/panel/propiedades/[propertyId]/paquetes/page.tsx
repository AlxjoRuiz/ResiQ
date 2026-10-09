import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { packageStatusLabel, receivedItemLabel } from "@/lib/packages/constants";

type UnitRelation = { code: string; buildings: { name: string } | { name: string }[] | null } | { code: string; buildings: { name: string } | { name: string }[] | null }[] | null;
function unitLabel(units: UnitRelation) { const unit = Array.isArray(units) ? units[0] : units; const building = Array.isArray(unit?.buildings) ? unit.buildings[0] : unit?.buildings; return [building?.name, unit?.code].filter(Boolean).join(" · ") || "Apartamento"; }
const formatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });

export default async function PackagesPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  const canManage = membership.roles.some((role: string) => role === "administrator" || role === "concierge");
  const { data: packages } = await supabase.from("packages").select("id,kind,utility_service,recipient_name,carrier,description,status,received_at,units(code,buildings(name))").eq("property_id", propertyId).order("received_at", { ascending: false });
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10"><header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6"><div><Link href={`/panel/propiedades/${propertyId}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">← Panel de {property.name}</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Recepción y entrega</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Paquetes y recibos</h1><p className="mt-2 text-sm text-muted-foreground">Cada residente ve únicamente las entregas asociadas expresamente a su cuenta.</p></div>{canManage && <Button asChild><Link href={`/panel/propiedades/${propertyId}/paquetes/nuevo`}>Registrar llegada</Link></Button>}</header><section className="mt-7 grid gap-4">{(packages ?? []).length === 0 ? <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No hay entregas visibles para tu cuenta.</div> : packages?.map((item) => <Link key={item.id} href={`/panel/propiedades/${propertyId}/paquetes/${item.id}`} className="rounded-2xl border bg-card p-5 transition-colors hover:bg-muted/50"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">{unitLabel(item.units as UnitRelation)} · {receivedItemLabel(item.kind, item.utility_service)}</p><h2 className="mt-2 text-lg font-semibold">{item.recipient_name}</h2><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{packageStatusLabel(item.status)}</span></div><p className="mt-3 text-xs text-muted-foreground">Recibido el {formatter.format(new Date(item.received_at))}</p></Link>)}</section></main>;
}
