import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateReservationForm, type ReservationAmenity } from "@/components/reservations/reservation-forms";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { weekdayShortLabel } from "@/lib/reservations/constants";

type Hour = { weekday: number; opens_at: string; closes_at: string };
type Amenity = ReservationAmenity & { description: string | null; rules: string | null; amenity_hours?: Hour[] };
type OccupiedInterval = { starts_at: string; ends_at: string; kind: string };
type UnitRelation = { id: string; code: string; buildings: { name: string } | { name: string }[] | null } | { id: string; code: string; buildings: { name: string } | { name: string }[] | null }[] | null;
function unitOption(units: UnitRelation) { const unit=Array.isArray(units)?units[0]:units; const building=Array.isArray(unit?.buildings)?unit.buildings[0]:unit?.buildings; return unit ? { id: unit.id, label: [building?.name,unit.code].filter(Boolean).join(" · ") } : null; }

export default async function NewReservationPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  if (!membership.roles.includes("member")) notFound();
  const [{ data: rawAmenities }, { data: links }] = await Promise.all([
    supabase.from("amenities").select("id,name,description,capacity,requires_approval,rules,slot_minutes,amenity_hours(weekday,opens_at,closes_at)").eq("property_id", propertyId).eq("status", "active").order("name"),
    supabase.from("unit_memberships").select("units(id,code,buildings(name))").eq("property_id", propertyId).eq("member_id", membership.id).is("valid_to", null),
  ]);
  const amenities=(rawAmenities??[]) as unknown as Amenity[];
  const units=(links??[]).map((row)=>unitOption(row.units as UnitRelation)).filter((row):row is {id:string;label:string}=>Boolean(row));
  const from=new Date(),to=new Date();to.setDate(to.getDate()+30);
  const availability=new Map<string,OccupiedInterval[]>((await Promise.all(amenities.map(async(amenity)=>{const {data}=await supabase.rpc("get_amenity_availability",{target_amenity_id:amenity.id,target_from:from.toISOString(),target_to:to.toISOString()});return[amenity.id,(data??[]) as OccupiedInterval[]] as const;}))));
  const formatter=new Intl.DateTimeFormat("es-CO",{dateStyle:"short",timeStyle:"short",timeZone:property.timezone});
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10"><header className="border-b pb-6"><Link href={`/panel/propiedades/${propertyId}/reservas`} className="text-sm text-muted-foreground hover:text-foreground">← Reservas de {property.name}</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Nueva solicitud</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Reservar una zona</h1><p className="mt-2 text-sm text-muted-foreground">Los horarios se muestran y se registran según {property.timezone}.</p></header><section className="mt-7"><Card><CardContent><CreateReservationForm propertyId={propertyId} amenities={amenities} units={units}/></CardContent></Card></section><section className="mt-7 grid gap-4 sm:grid-cols-2">{amenities.map((amenity)=><Card key={amenity.id}><CardContent><h2 className="text-lg font-semibold">{amenity.name}</h2><p className="mt-2 text-sm text-muted-foreground">Capacidad {amenity.capacity} · bloques de {amenity.slot_minutes} minutos</p><div className="mt-3 flex flex-wrap gap-2">{(amenity.amenity_hours??[]).sort((a,b)=>a.weekday-b.weekday).map((hour)=><span key={`${hour.weekday}-${hour.opens_at}`} className="rounded-full bg-secondary px-3 py-1 text-xs">{weekdayShortLabel(hour.weekday)} {hour.opens_at.slice(0,5)}–{hour.closes_at.slice(0,5)}</span>)}</div>{amenity.rules&&<p className="mt-4 whitespace-pre-line text-sm leading-6">{amenity.rules}</p>}<div className="mt-5 border-t pt-4"><h3 className="text-sm font-semibold">Ocupación de los próximos 30 días</h3>{(availability.get(amenity.id)??[]).length===0?<p className="mt-2 text-xs text-muted-foreground">No hay intervalos ocupados ni cierres.</p>:<ul className="mt-2 grid gap-1">{(availability.get(amenity.id)??[]).map((interval,index)=><li key={`${interval.starts_at}-${index}`} className="text-xs text-muted-foreground">{formatter.format(new Date(interval.starts_at))} → {formatter.format(new Date(interval.ends_at))} · {interval.kind==="blackout"?"Cierre":"Ocupado"}</li>)}</ul>}</div></CardContent></Card>)}</section></main>;
}
