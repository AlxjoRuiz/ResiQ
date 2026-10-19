import Link from "next/link";
import { notFound } from "next/navigation";
import { type ReservationAmenity } from "@/components/reservations/reservation-forms";
import { ReservationBooking } from "@/components/reservations/reservation-booking";
import { type AvailabilityInterval } from "@/components/reservations/availability-calendar";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { slotDurationHoursLabel, weekdayShortLabel } from "@/lib/reservations/constants";
import { dateInputValue } from "@/lib/time-zone";

type Hour = { weekday: number; opens_at: string; closes_at: string };
type Amenity = ReservationAmenity & { description: string | null; rules: string | null; amenity_hours?: Hour[] };
type UnitRelation = { id: string; code: string; buildings: { name: string } | { name: string }[] | null } | { id: string; code: string; buildings: { name: string } | { name: string }[] | null }[] | null;
function unitOption(units: UnitRelation) { const unit=Array.isArray(units)?units[0]:units; const building=Array.isArray(unit?.buildings)?unit.buildings[0]:unit?.buildings; return unit ? { id: unit.id, label: [building?.name,unit.code].filter(Boolean).join(" · ") } : null; }

export default async function NewReservationPage({ params, searchParams }: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ month?: string; zone?: string }>;
}) {
  const { propertyId } = await params;
  const requested = await searchParams;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  if (!membership.roles.includes("member")) notFound();
  const [{ data: rawAmenities }, { data: links }] = await Promise.all([
    supabase.from("amenities").select("id,name,description,capacity,requires_approval,rules,slot_minutes,amenity_hours(weekday,opens_at,closes_at)").eq("property_id", propertyId).eq("status", "active").order("name"),
    supabase.from("unit_memberships").select("units(id,code,buildings(name))").eq("property_id", propertyId).eq("member_id", membership.id).is("valid_to", null),
  ]);
  const amenities=(rawAmenities??[]) as unknown as Amenity[];
  const units=(links??[]).map((row)=>unitOption(row.units as UnitRelation)).filter((row):row is {id:string;label:string}=>Boolean(row));
  const now = new Date();
  const today = dateInputValue(now, property.timezone);
  const firstMonth = today.slice(0, 7);
  const lastMonthDate = new Date(`${firstMonth}-01T12:00:00Z`);
  lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() + 11);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);
  const month = typeof requested.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested.month)
    && requested.month >= firstMonth && requested.month <= lastMonth ? requested.month : firstMonth;
  const monthStart = new Date(`${month}-01T12:00:00Z`);
  const from = new Date(monthStart);
  from.setUTCDate(from.getUTCDate() - 2);
  const to = new Date(monthStart);
  to.setUTCMonth(to.getUTCMonth() + 1);
  to.setUTCDate(to.getUTCDate() + 2);
  const initialZoneId = amenities.some((amenity) => amenity.id === requested.zone) ? requested.zone! : amenities[0]?.id ?? "";
  const availability=new Map<string,AvailabilityInterval[]>((await Promise.all(amenities.map(async(amenity)=>{const {data,error}=await supabase.rpc("get_amenity_availability_with_reason",{target_amenity_id:amenity.id,target_from:from.toISOString(),target_to:to.toISOString()});if(error)throw error;return[amenity.id,(data??[]) as AvailabilityInterval[]] as const;}))));
  const calendarZones=amenities.map((amenity)=>({id:amenity.id,name:amenity.name,hours:amenity.amenity_hours??[],intervals:availability.get(amenity.id)??[]}));
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10"><header className="border-b pb-6"><Link href={`/panel/propiedades/${propertyId}/reservas`} className="text-sm text-muted-foreground hover:text-foreground">← Volver a Reservas</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Nueva solicitud</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Reservar una zona</h1><p className="mt-2 text-sm text-muted-foreground">Los horarios se muestran y se registran según {property.timezone}.</p></header><ReservationBooking key={`${month}-${initialZoneId}`} propertyId={propertyId} amenities={amenities} units={units} zones={calendarZones} timeZone={property.timezone} today={today} month={month} initialZoneId={initialZoneId}/><section className="mt-7 grid gap-4 sm:grid-cols-2">{amenities.map((amenity)=><Card key={amenity.id}><CardContent><h2 className="text-lg font-semibold">{amenity.name}</h2><p className="mt-2 text-sm text-muted-foreground">Capacidad {amenity.capacity} · máximo {slotDurationHoursLabel(amenity.slot_minutes)} por reserva</p><div className="mt-3 flex flex-wrap gap-2">{(amenity.amenity_hours??[]).sort((a,b)=>a.weekday-b.weekday).map((hour)=><span key={`${hour.weekday}-${hour.opens_at}`} className="rounded-full bg-secondary px-3 py-1 text-xs">{weekdayShortLabel(hour.weekday)} {hour.opens_at.slice(0,5)}–{hour.closes_at.slice(0,5)}{hour.closes_at <= hour.opens_at ? " (día siguiente)" : ""}</span>)}</div>{amenity.rules&&<p className="mt-4 whitespace-pre-line text-sm leading-6">{amenity.rules}</p>}</CardContent></Card>)}</section></main>;
}
