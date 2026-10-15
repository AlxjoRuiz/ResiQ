import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CancelReservationForm, DecisionForm } from "@/components/reservations/reservation-forms";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { reservationStatusLabel } from "@/lib/reservations/constants";

type OperationalRow = {
  reservation_id: string; amenity_name: string; building_name: string; unit_code: string;
  requester_name: string; attendee_count: number; status: string; starts_at: string;
  ends_at: string; purpose: string | null; review_message: string | null; decision_reason: string | null;
};
type OwnRow = {
  id: string; attendee_count: number; status: string; starts_at: string; ends_at: string;
  hold_expires_at: string | null; purpose: string | null; review_message: string | null; decision_reason: string | null;
  amenities: { name: string } | { name: string }[] | null;
  units: { code: string; buildings: { name: string } | { name: string }[] | null } |
    { code: string; buildings: { name: string } | { name: string }[] | null }[] | null;
};
type DisplayRow = {
  id: string; amenity: string; unit: string; requester?: string; attendeeCount: number;
  status: string; startsAt: string; endsAt: string; holdExpiresAt?: string | null;
  purpose?: string | null; reviewMessage?: string | null; reason?: string | null;
};
function one<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] : value; }

export default async function ReservationsPage({ params, searchParams }: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ created?: string; status?: string; zone?: string }>;
}) {
  const { propertyId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  await supabase.rpc("refresh_reservations", { target_property_id: propertyId });
  const administrator = membership.roles.includes("administrator");
  const concierge = membership.roles.includes("concierge");
  const resident = membership.roles.includes("member");
  let rows: DisplayRow[] = [];

  if (administrator || concierge) {
    const from = new Date(); from.setDate(from.getDate() - 30);
    const to = new Date(); to.setDate(to.getDate() + 93);
    const { data, error } = await supabase.rpc("list_operational_reservations_with_context", {
      target_property_id: propertyId, target_from: from.toISOString(), target_to: to.toISOString(),
    });
    if (error) throw error;
    rows = ((data ?? []) as OperationalRow[]).map((row) => ({
      id: row.reservation_id, amenity: row.amenity_name,
      unit: [row.building_name, row.unit_code].filter(Boolean).join(" · "), requester: row.requester_name,
      attendeeCount: row.attendee_count, status: row.status, startsAt: row.starts_at, endsAt: row.ends_at,
      purpose: row.purpose, reviewMessage: row.review_message, reason: row.decision_reason,
    }));
    if (administrator) {
      const { data: pending, error: pendingError } = await supabase.from("reservations")
        .select("id,hold_expires_at").eq("property_id", propertyId).eq("status", "pending");
      if (pendingError) throw pendingError;
      const deadlines = new Map((pending ?? []).map((item) => [item.id, item.hold_expires_at]));
      rows = rows.map((row) => ({ ...row, holdExpiresAt: deadlines.get(row.id) ?? null }));
    }
  } else {
    const { data, error } = await supabase.from("reservations")
      .select("id,attendee_count,status,starts_at,ends_at,hold_expires_at,purpose,review_message,decision_reason,amenities(name),units(code,buildings(name))")
      .eq("property_id", propertyId).order("starts_at", { ascending: false }).limit(100);
    if (error) throw error;
    rows = ((data ?? []) as unknown as OwnRow[]).map((row) => {
      const amenity = one(row.amenities), unit = one(row.units), building = one(unit?.buildings ?? null);
      return {
        id: row.id, amenity: amenity?.name ?? "Zona", unit: [building?.name, unit?.code].filter(Boolean).join(" · "),
        attendeeCount: row.attendee_count, status: row.status, startsAt: row.starts_at, endsAt: row.ends_at,
        holdExpiresAt: row.hold_expires_at, purpose: row.purpose, reviewMessage: row.review_message,
        reason: row.decision_reason,
      };
    });
  }

  rows.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const filters = await searchParams;
  const statuses = new Set(["pending", "approved", "rejected", "cancelled", "expired", "completed"]);
  const selectedStatus = filters.status && statuses.has(filters.status) ? filters.status : "all";
  const zones = [...new Set(rows.map((row) => row.amenity))].sort((a, b) => a.localeCompare(b, "es"));
  const selectedZone = filters.zone && zones.includes(filters.zone) ? filters.zone : "all";
  const visibleRows = rows.filter((row) =>
    (selectedStatus === "all" || row.status === selectedStatus) &&
    (selectedZone === "all" || row.amenity === selectedZone));
  const formatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: property.timezone });
  const pendingCount = administrator ? rows.filter((row) => row.status === "pending").length : 0;
  const urgentCount = administrator ? rows.filter((row) => row.status === "pending" && row.holdExpiresAt && new Date(row.holdExpiresAt).getTime() - new Date().getTime() <= 2 * 60 * 60 * 1000).length : 0;
  const created = filters.created === "1";

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-10">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
      <div>
        <Link href={`/panel/propiedades/${propertyId}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">← Panel de {property.name}</Link>
        <p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Zonas comunes</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Reservas</h1>
        <p className="mt-2 text-sm text-muted-foreground">{administrator ? "Aprueba solicitudes y consulta la agenda completa." : concierge ? "Consulta la agenda operativa de la propiedad." : "Consulta y administra tus propias reservas."}</p>
      </div>
      {resident && <Button asChild><Link href={`/panel/propiedades/${propertyId}/reservas/nueva`}>Nueva reserva</Link></Button>}
    </header>
    {created && <p role="status" className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-primary">La reserva fue creada correctamente.</p>}
    {administrator && pendingCount > 0 && <p role="status" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Tienes {pendingCount} {pendingCount === 1 ? "solicitud pendiente" : "solicitudes pendientes"} de respuesta.{urgentCount > 0 ? ` ${urgentCount} ${urgentCount === 1 ? "vence" : "vencen"} en menos de 2 horas.` : ""} Usa el filtro «Pendientes» para revisarlas.</p>}
    <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
      <label className="grid gap-1 text-sm">Estado
        <select name="status" defaultValue={selectedStatus} className="min-w-40 rounded-lg border bg-background px-3 py-2">
          <option value="all">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobadas</option>
          <option value="rejected">Rechazadas</option>
          <option value="cancelled">Canceladas</option>
          <option value="expired">Vencidas</option>
          <option value="completed">Finalizadas</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">Zona
        <select name="zone" defaultValue={selectedZone} className="min-w-40 rounded-lg border bg-background px-3 py-2">
          <option value="all">Todas</option>
          {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
        </select>
      </label>
      <Button type="submit" variant="outline">Filtrar</Button>
      <p className="text-xs text-muted-foreground">Ordenadas por fecha de reserva, de la más reciente a la más antigua.</p>
    </form>
    <section className="mt-7 grid gap-4">
      {visibleRows.length === 0 ? <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No hay reservas para estos filtros.</div> : visibleRows.map((row) => {
        const response = row.reviewMessage ?? (row.status === "rejected" ? row.reason : null);
        return <article key={row.id} className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wider text-primary uppercase">{row.amenity}</p>
              <h2 className="mt-2 text-lg font-semibold">{formatter.format(new Date(row.startsAt))} → {formatter.format(new Date(row.endsAt))}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{row.unit} · {row.attendeeCount} asistentes{row.requester ? ` · ${row.requester}` : ""}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm"><strong>Motivo de la reserva:</strong> {row.purpose ?? "No registrado en esta solicitud anterior."}</p>
              {response && <p className="mt-2 whitespace-pre-wrap text-sm"><strong>Respuesta de Administración:</strong> {response}</p>}
              {row.status === "cancelled" && row.reason && <p className="mt-2 whitespace-pre-wrap text-sm"><strong>Motivo de cancelación:</strong> {row.reason}</p>}
              {row.status === "pending" && row.holdExpiresAt && <p className="mt-2 text-sm font-medium text-amber-900">{administrator ? "Responder antes del " : "Pendiente de aprobación hasta el "}{formatter.format(new Date(row.holdExpiresAt))}.</p>}
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{reservationStatusLabel(row.status)}</span>
          </div>
          {administrator && row.status === "pending" && <div className="mt-5 border-t pt-5"><DecisionForm propertyId={propertyId} reservationId={row.id}/></div>}
          {(administrator || (!concierge && resident)) && ["pending", "approved"].includes(row.status) && new Date(row.startsAt) > new Date() && <details className="mt-5 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Cancelar reserva</summary><div className="mt-4"><CancelReservationForm propertyId={propertyId} reservationId={row.id}/></div></details>}
        </article>;
      })}
    </section>
  </main>;
}
