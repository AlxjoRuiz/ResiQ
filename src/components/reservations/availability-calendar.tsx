"use client";

import Link from "next/link";
import { useState } from "react";

export type AvailabilityInterval = { starts_at: string; ends_at: string; kind: string; reason?: string | null };
export type AvailabilityZone = {
  id: string;
  name: string;
  hours: { weekday: number; opens_at: string; closes_at: string }[];
  intervals: AvailabilityInterval[];
};

function dayKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(key: string, count: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function shiftMonth(month: string, count: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + count);
  return date.toISOString().slice(0, 7);
}

function weekday(key: string) {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function hasOpeningOnDay(zone: AvailabilityZone | undefined, key: string) {
  if (!zone) return false;
  if (zone.hours.some((hour) => hour.weekday === weekday(key))) return true;
  return zone.hours.some((hour) =>
    hour.weekday === weekday(addDays(key, -1)) && hour.closes_at <= hour.opens_at);
}

function activeOnDay(interval: AvailabilityInterval, key: string, timeZone: string) {
  return dayKey(new Date(interval.starts_at), timeZone) <= key &&
    dayKey(new Date(new Date(interval.ends_at).getTime() - 1), timeZone) >= key;
}

export function AvailabilityCalendar({ zones, timeZone, today, month, propertyId, zoneId, onZoneChange }: {
  zones: AvailabilityZone[]; timeZone: string; today: string; month: string; propertyId: string; zoneId: string; onZoneChange: (zoneId: string) => void;
}) {
  const [selectedDay, setSelectedDay] = useState(month === today.slice(0, 7) ? today : `${month}-01`);
  const zone = zones.find((item) => item.id === zoneId);
  const firstDay = `${month}-01`;
  const dayCount = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const days = Array.from({ length: dayCount }, (_, index) => addDays(firstDay, index));
  const leading = weekday(firstDay) - 1;
  const dateFormatter = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
  const monthFormatter = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
  const timeFormatter = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone });
  const selectedIntervals = zone?.intervals.filter((item) => activeOnDay(item, selectedDay, timeZone)) ?? [];
  const selectedHours = zone?.hours.find((item) => item.weekday === weekday(selectedDay));
  const previousHours = zone?.hours.find((item) =>
    item.weekday === weekday(addDays(selectedDay, -1)) && item.closes_at <= item.opens_at);

  if (zones.length === 0) return null;

  const monthHref = (target: string) => `/panel/propiedades/${propertyId}/reservas/nueva?month=${target}&zone=${encodeURIComponent(zoneId)}`;
  const firstMonth = today.slice(0, 7);
  const lastMonth = shiftMonth(firstMonth, 11);

  return <section className="mt-7 rounded-2xl border bg-card p-5" aria-labelledby="availability-heading">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 id="availability-heading" className="text-lg font-semibold">Calendario de disponibilidad</h2>
        <p className="mt-1 text-sm text-muted-foreground">Consulta ocupaciones y cierres de este mes o de los próximos once antes de elegir tu horario.</p>
      </div>
      <label className="grid gap-1 text-sm">Zona
        <select className="min-w-48 rounded-lg border bg-background px-3 py-2" value={zoneId} onChange={(event) => onZoneChange(event.target.value)}>
          {zones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">La zona elegida aquí también queda seleccionada en el formulario de reserva.</p>
    <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3" aria-label="Navegación del calendario">
      {month > firstMonth ? <Link aria-label="Mes anterior" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted" href={monthHref(shiftMonth(month, -1))}><span aria-hidden="true" className="sm:hidden">←</span><span className="hidden sm:inline">← Anterior</span></Link> : <span />}
      <h3 className="min-w-0 text-center text-sm font-semibold capitalize sm:text-base">{monthFormatter.format(new Date(`${firstDay}T12:00:00Z`))}</h3>
      {month < lastMonth ? <Link aria-label="Mes siguiente" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted" href={monthHref(shiftMonth(month, 1))}><span aria-hidden="true" className="sm:hidden">→</span><span className="hidden sm:inline">Siguiente →</span></Link> : <span />}
    </div>
    <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground" aria-hidden="true">
      {(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const).map((label) => <span key={label}>{label}</span>)}
    </div>
    <div className="mt-2 grid grid-cols-7 gap-1">
      {Array.from({ length: leading }, (_, index) => <span key={`empty-${index}`} />)}
      {days.map((key) => {
        const intervals = zone?.intervals.filter((item) => activeOnDay(item, key, timeZone)) ?? [];
        const hasClosure = intervals.some((item) => item.kind === "closed");
        const hasOccupation = intervals.some((item) => item.kind === "occupied");
        const hasOpening = hasOpeningOnDay(zone, key);
        const label = !hasOpening ? "Sin horario" : hasClosure ? "Cierre" : hasOccupation ? "Ocupación" : "Sin cruces";
        return <button key={key} type="button" onClick={() => setSelectedDay(key)} aria-pressed={selectedDay === key}
          aria-label={`${dateFormatter.format(new Date(`${key}T12:00:00Z`))}: ${label}`}
          className={`flex min-w-0 min-h-12 flex-col items-center justify-center rounded-lg border p-1 text-xs transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary sm:min-h-16 sm:items-start sm:justify-start ${selectedDay === key ? "border-primary ring-1 ring-primary" : ""} ${!hasOpening ? "bg-slate-100" : hasClosure ? "bg-rose-50" : hasOccupation ? "bg-amber-50" : "bg-emerald-50"}`}>
          <span className="font-semibold sm:hidden">{Number(key.slice(-2))}</span>
          <span className="hidden font-semibold sm:block">{dateFormatter.format(new Date(`${key}T12:00:00Z`))}</span>
          <span className="mt-1 hidden text-[10px] leading-tight sm:block">{label}</span>
        </button>;
      })}
    </div>
    <p className="mt-2 text-xs text-muted-foreground sm:hidden">Verde: sin cruces · Amarillo: ocupado · Rojo: cierre · Gris: sin horario. Toca un día para ver sus horarios.</p>
    <div className="mt-5 rounded-xl border bg-background p-4">
      <h3 className="font-semibold">{dateFormatter.format(new Date(`${selectedDay}T12:00:00Z`))} · {zone?.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{selectedHours
        ? `Horario del día: ${selectedHours.opens_at.slice(0, 5)}–${selectedHours.closes_at.slice(0, 5)}${selectedHours.closes_at <= selectedHours.opens_at ? " (día siguiente)" : ""}.`
        : previousHours ? `Solo continúa el horario del día anterior hasta las ${previousHours.closes_at.slice(0, 5)}.`
          : "Esta zona no tiene horario configurado para este día."}</p>
      {selectedIntervals.length === 0
        ? <p className="mt-3 text-sm">No hay reservas ni cierres registrados para este día.</p>
        : <ul className="mt-3 grid gap-2">{selectedIntervals.map((item, index) => <li key={`${item.starts_at}-${index}`} className="min-w-0 text-sm">
          <span className="font-medium">{item.kind === "closed" ? "Cierre" : "Ocupado"}:</span> {timeFormatter.format(new Date(item.starts_at))} → {timeFormatter.format(new Date(item.ends_at))}
          {item.kind === "closed" && item.reason && <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground"><span className="font-medium text-foreground">Motivo:</span> {item.reason}</p>}
        </li>)}</ul>}
      <p className="mt-3 text-xs text-muted-foreground">Los tramos sin cruces también deben respetar el horario de la zona y pasar la validación al reservar. Las reservas de otros residentes se muestran sin datos personales.</p>
    </div>
  </section>;
}
