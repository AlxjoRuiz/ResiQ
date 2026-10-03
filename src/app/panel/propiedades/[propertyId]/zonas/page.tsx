import Link from "next/link";
import { notFound } from "next/navigation";
import { AmenityForm, BlackoutForm, DeleteBlackoutForm, ReservationPolicyForm, type AmenityFormValue } from "@/components/reservations/reservation-forms";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { weekdayShortLabel } from "@/lib/reservations/constants";

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
    <header className="border-b pb-6"><Link href={`/panel/propiedades/${propertyId}/dashboard?vista=administracion`} className="text-sm text-muted-foreground hover:text-foreground">← Panel de {property.name}</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Configuración</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Zonas comunes</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Define capacidad, bloques, horarios, aprobación y cierres. Los cambios se validan en el servidor y quedan registrados en auditoría.</p></header>
    <section className="mt-7"><Card><CardContent><h2 className="text-lg font-semibold">Política de reservas</h2><p className="mt-2 mb-5 text-sm text-muted-foreground">Una solicitud pendiente conserva el horario durante este periodo, sin superar la hora de inicio. La restricción por cartera se configura desde el módulo financiero.</p><ReservationPolicyForm propertyId={propertyId} pendingHoldMinutes={policy?.pending_hold_minutes ?? 1440}/></CardContent></Card></section>
    <section className="mt-7"><Card><CardContent><h2 className="text-lg font-semibold">Crear zona</h2><p className="mt-2 mb-5 text-sm text-muted-foreground">Cada zona reserva un solo grupo por intervalo durante esta primera versión.</p><AmenityForm propertyId={propertyId}/></CardContent></Card></section>
    <section className="mt-8 grid gap-6"><div><p className="text-sm text-muted-foreground">{amenities.length} configuradas</p><h2 className="text-2xl font-semibold tracking-tight">Zonas de la propiedad</h2></div>{amenities.length===0?<div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Todavía no hay zonas configuradas.</div>:amenities.map((amenity)=><Card key={amenity.id}><CardContent><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">{amenity.status==="active"?"Activa":"Inactiva"}</p><h3 className="mt-2 text-xl font-semibold">{amenity.name}</h3><p className="mt-2 text-sm text-muted-foreground">Capacidad {amenity.capacity} · bloques de {amenity.slot_minutes} minutos · {amenity.requires_approval?"requiere aprobación":"confirmación automática"}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{(amenity.amenity_hours??[]).sort((a,b)=>a.weekday-b.weekday).map((hour)=><span key={`${hour.weekday}-${hour.opens_at}`} className="rounded-full bg-secondary px-3 py-1 text-xs">{weekdayShortLabel(hour.weekday)} {hour.opens_at.slice(0,5)}–{hour.closes_at.slice(0,5)}</span>)}</div><details className="mt-6 rounded-xl border p-4"><summary className="cursor-pointer font-medium">Editar configuración</summary><div className="mt-5"><AmenityForm propertyId={propertyId} amenity={amenity}/></div></details><div className="mt-5"><BlackoutForm propertyId={propertyId} amenityId={amenity.id}/></div>{(amenity.amenity_blackouts??[]).length>0&&<div className="mt-5 grid gap-3"><h4 className="text-sm font-semibold">Cierres programados</h4>{(amenity.amenity_blackouts??[]).map((blackout)=><div key={blackout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3"><div><p className="text-sm font-medium">{formatter.format(new Date(blackout.starts_at))} → {formatter.format(new Date(blackout.ends_at))}</p><p className="text-xs text-muted-foreground">{blackout.reason}</p></div><DeleteBlackoutForm propertyId={propertyId} blackoutId={blackout.id}/></div>)}</div>}</CardContent></Card>)}</section>
  </main>;
}
