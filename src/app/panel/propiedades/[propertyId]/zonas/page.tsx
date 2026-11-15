import Link from "next/link";
import { Trees } from "lucide-react";
import { FactGrid, ItemHeader } from "@/components/ui/accent";
import { statusPill } from "@/lib/ui/status-tones";
import { notFound } from "next/navigation";
import { AmenityForm, BlackoutForm, DeleteBlackoutForm, ReservationPolicyForm, type AmenityFormValue } from "@/components/reservations/reservation-forms";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { slotDurationHoursLabel, weekdayShortLabel } from "@/lib/reservations/constants";

type Blackout = { id: string; starts_at: string; ends_at: string; reason: string };
type Amenity = AmenityFormValue & { amenity_blackouts?: Blackout[] };

export default async function ZonesPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  if (!membership.roles.includes("administrator")) notFound();
  const [{ data: policy }, { data: rawAmenities, error }] = await Promise.all([
    supabase.from("property_policies").select("pending_hold_minutes,restrict_reservations_for_debt").eq("property_id", propertyId).maybeSingle(),
    supabase.from("amenities").select("id,name,description,capacity,requires_approval,rules,slot_minutes,status,amenity_hours(weekday,opens_at,closes_at),amenity_blackouts(id,starts_at,ends_at,reason)").eq("property_id", propertyId).order("name"),
  ]);
  if (error) throw error;
  const amenities = (rawAmenities ?? []) as unknown as Amenity[];
  const formatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: property.timezone });
  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-10">
    <header className="border-b pb-6"><Link href={`/panel/propiedades/${propertyId}/dashboard?vista=administracion`} className="text-sm text-muted-foreground hover:text-foreground">← Volver al inicio</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Configuración</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Zonas comunes</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Define capacidad, duración máxima por reserva, horarios, aprobación y cierres. Los cambios se validan en el servidor y quedan registrados en auditoría.</p></header>
    <section className="mt-7"><Card><CardContent className="p-4 sm:p-6"><h2 className="text-lg font-semibold text-primary">Política de reservas</h2><p className="mt-2 mb-5 text-sm text-muted-foreground">Una solicitud pendiente conserva el horario durante este periodo, sin superar la hora de inicio. La restricción por cartera se configura desde el módulo financiero.</p><ReservationPolicyForm propertyId={propertyId} pendingHoldMinutes={policy?.pending_hold_minutes ?? 1440}/></CardContent></Card></section>
    {/* «Crear zona» (14/11/2026): pestaña que se abre y se cierra, con el mismo recuadro azul de «Editar configuración». */}
    <section className="mt-7"><details className="min-w-0 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-6"><summary className="cursor-pointer rounded-lg text-lg font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">Crear zona</summary><p className="mt-2 mb-5 text-sm text-muted-foreground">Cada zona reserva un solo grupo por intervalo durante esta primera versión.</p><AmenityForm propertyId={propertyId}/></details></section>
    <section className="mt-8 grid gap-6"><div><p className="text-sm text-muted-foreground">{amenities.length} configuradas</p><h2 className="text-2xl font-semibold tracking-tight text-primary">Zonas de la propiedad</h2></div>{amenities.length===0?<div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Todavía no hay zonas configuradas.</div>:amenities.map((amenity)=><Card key={amenity.id}><CardContent className="p-4 sm:p-6"><ItemHeader as="h3" icon={Trees} title={amenity.name} subtitle="Zona común" badge={<span className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill[amenity.status==="active"?"success":"neutral"]}`}>{amenity.status==="active"?"Activa":"Inactiva"}</span>} /><FactGrid className="mt-4" columns="grid-cols-2 sm:grid-cols-3" facts={[{label:"Capacidad",value:amenity.capacity},{label:"Máximo por reserva",value:slotDurationHoursLabel(amenity.slot_minutes)},{label:"Aprobación",value:amenity.requires_approval?"Requiere aprobación":"Confirmación automática"}]} /><div className="mt-4 flex flex-wrap gap-2">{(amenity.amenity_hours??[]).sort((a,b)=>a.weekday-b.weekday).map((hour)=><span key={`${hour.weekday}-${hour.opens_at}`} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{weekdayShortLabel(hour.weekday)} {hour.opens_at.slice(0,5)}–{hour.closes_at.slice(0,5)}{hour.closes_at <= hour.opens_at ? " (día siguiente)" : ""}</span>)}</div><details className="mt-6 min-w-0 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:p-4"><summary className="cursor-pointer rounded-lg font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">Editar configuración</summary><div className="mt-5"><AmenityForm propertyId={propertyId} amenity={amenity}/></div></details><div className="mt-5"><BlackoutForm propertyId={propertyId} amenityId={amenity.id}/></div>{(amenity.amenity_blackouts??[]).length>0&&<div className="mt-5 grid gap-3"><h4 className="text-sm font-semibold text-primary">Cierres programados</h4>{(amenity.amenity_blackouts??[]).map((blackout)=><div key={blackout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3"><div><p className="text-sm font-medium">{formatter.format(new Date(blackout.starts_at))} → {formatter.format(new Date(blackout.ends_at))}</p><p className="text-xs text-muted-foreground">{blackout.reason}</p></div><DeleteBlackoutForm propertyId={propertyId} blackoutId={blackout.id}/></div>)}</div>}</CardContent></Card>)}</section>
  </main>;
}
