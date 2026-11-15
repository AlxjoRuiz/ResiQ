import Link from "next/link";
import { Package } from "lucide-react";
import { FactGrid, ItemHeader } from "@/components/ui/accent";
import { statusPill } from "@/lib/ui/status-tones";
import { Button } from "@/components/ui/button";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { packageStatusLabel, receivedItemLabel } from "@/lib/packages/constants";
import { dateTimeFormatter } from "@/lib/time-zone";
import { PorteriaPackages } from "./porteria-packages";

type UnitRelation = { code: string; buildings: { name: string } | { name: string }[] | null } | { code: string; buildings: { name: string } | { name: string }[] | null }[] | null;
function unitLabel(units: UnitRelation) { const unit = Array.isArray(units) ? units[0] : units; const building = Array.isArray(unit?.buildings) ? unit.buildings[0] : unit?.buildings; return [building?.name, unit?.code].filter(Boolean).join(" · ") || "Apartamento"; }

export default async function PackagesPage({ params, searchParams }: { params: Promise<{ propertyId: string }>; searchParams: Promise<{ vista?: string; pagina?: string; fecha?: string }> }) {
  const { propertyId } = await params;
  const filters = await searchParams;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  // Portería registra y entrega desde su vista con pestañas; administración ve las mismas
  // pestañas y el detalle, solo para consultar.
  const isConcierge = membership.roles.includes("concierge");
  if (isConcierge || membership.roles.includes("administrator")) {
    const tab = filters.vista === "hoy" || filters.vista === "historial" ? filters.vista : "pendientes";
    const page = Math.max(1, Math.min(1000, Number.isSafeInteger(Number(filters.pagina)) ? Number(filters.pagina) : 1));
    return <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10"><header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6"><div><Link href={`/panel/propiedades/${propertyId}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">← Volver al inicio</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Recepción y entrega</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Paquetes</h1><p className="mt-2 text-sm text-muted-foreground">{isConcierge ? "Paquetes en portería, entregas de hoy e historial." : "Consulta los paquetes en portería, las entregas de hoy y el historial. Portería registra las llegadas y las entregas."}</p></div>{isConcierge && <Button asChild><Link href={`/panel/propiedades/${propertyId}/paquetes/nuevo`}>Registrar llegada</Link></Button>}</header><PorteriaPackages supabase={supabase} propertyId={propertyId} timeZone={property.timezone} tab={tab} page={page} date={filters.fecha} readOnly={!isConcierge} /></main>;
  }
  const formatter = dateTimeFormatter(property.timezone);
  const { data: packages } = await supabase.from("packages").select("id,kind,utility_service,recipient_name,carrier,description,status,received_at,units(code,buildings(name))").eq("property_id", propertyId).order("received_at", { ascending: false });
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10"><header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6"><div><Link href={`/panel/propiedades/${propertyId}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">← Volver al inicio</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Recepción y entrega</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Paquetes</h1><p className="mt-2 text-sm text-muted-foreground">Cada residente ve únicamente las entregas asociadas expresamente a su cuenta.</p></div></header><section className="mt-7 grid gap-4">{(packages ?? []).length === 0 ? <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No hay entregas visibles para tu cuenta.</div> : packages?.map((item) => <Link key={item.id} href={`/panel/propiedades/${propertyId}/paquetes/${item.id}`} className="rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"><ItemHeader icon={Package} title={item.recipient_name} subtitle={receivedItemLabel(item.kind, item.utility_service)} badge={<span className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill[item.status === "delivered" ? "neutral" : "success"]}`}>{packageStatusLabel(item.status)}</span>} /><FactGrid className="mt-4" facts={[{ label: "Apartamento", value: unitLabel(item.units as UnitRelation) }, { label: "Recibido", value: formatter.format(new Date(item.received_at)) }, ...(item.description ? [{ label: "Descripción", value: item.description, wide: true }] : [])]} /></Link>)}</section></main>;
}
