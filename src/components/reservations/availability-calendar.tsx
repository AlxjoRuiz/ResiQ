"use client";

import { useState } from "react";

export type AvailabilityInterval = { starts_at: string; ends_at: string; kind: string };
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

function weekday(key: string) {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function activeOnDay(interval: AvailabilityInterval, key: string, timeZone: string) {
  return dayKey(new Date(interval.starts_at), timeZone) <= key &&
    dayKey(new Date(new Date(interval.ends_at).getTime() - 1), timeZone) >= key;
}

export function AvailabilityCalendar({ zones, timeZone, today }: {
  zones: AvailabilityZone[]; timeZone: string; today: string;
}) {
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [selectedDay, setSelectedDay] = useState(today);
  const zone = zones.find((item) => item.id === zoneId);
  const days = Array.from({ length: 30 }, (_, index) => addDays(today, index));
  const leading = weekday(today) - 1;
  const dateFormatter = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
  const timeFormatter = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone });
  const selectedIntervals = zone?.intervals.filter((item) => activeOnDay(item, selectedDay, timeZone)) ?? [];
  const selectedHours = zone?.hours.find((item) => item.weekday === weekday(selectedDay));

  if (zones.length === 0) return null;

  return <section className="mt-7 rounded-2xl border bg-card p-5" aria-labelledby="availability-heading">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 id="availability-heading" className="text-lg font-semibold">Calendario de disponibilidad</h2>
        <p className="mt-1 text-sm text-muted-foreground">Consulta ocupaciones y cierres de los próximos 30 días antes de elegir tu horario.</p>
      </div>
      <label className="grid gap-1 text-sm">Zona
        <select className="min-w-48 rounded-lg border bg-background px-3 py-2" value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
          {zones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
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
        const label = hasClosure ? "Cierre" : hasOccupation ? "Ocupación" : "Sin cruces";
        return <button key={key} type="button" onClick={() => setSelectedDay(key)} aria-pressed={selectedDay === key}
          aria-label={`${dateFormatter.format(new Date(`${key}T12:00:00Z`))}: ${label}`}
          className={`flex min-w-0 min-h-12 flex-col items-center justify-center rounded-lg border p-1 text-xs transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary sm:min-h-16 sm:items-start sm:justify-start ${selectedDay === key ? "border-primary ring-1 ring-primary" : ""} ${hasClosure ? "bg-rose-50" : hasOccupation ? "bg-amber-50" : "bg-emerald-50"}`}>
          <span className="font-semibold sm:hidden">{Number(key.slice(-2))}</span>
          <span className="hidden font-semibold sm:block">{dateFormatter.format(new Date(`${key}T12:00:00Z`))}</span>
          <span className="mt-1 hidden text-[10px] leading-tight sm:block">{label}</span>
        </button>;
      })}
    </div>
    <p className="mt-2 text-xs text-muted-foreground sm:hidden">Verde: sin cruces · Amarillo: ocupado · Rojo: cierre. Toca un día para ver sus horarios.</p>
    <div className="mt-5 rounded-xl border bg-background p-4">
      <h3 className="font-semibold">{dateFormatter.format(new Date(`${selectedDay}T12:00:00Z`))} · {zone?.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{selectedHours
        ? `Horario del día: ${selectedHours.opens_at.slice(0, 5)}–${selectedHours.closes_at.slice(0, 5)}${selectedHours.closes_at <= selectedHours.opens_at ? " (día siguiente)" : ""}.`
        : "Esta zona no tiene horario de inicio configurado para este día."}</p>
      {selectedIntervals.length === 0
        ? <p className="mt-3 text-sm">No hay reservas ni cierres registrados para este día.</p>
        : <ul className="mt-3 grid gap-2">{selectedIntervals.map((item, index) => <li key={`${item.starts_at}-${index}`} className="text-sm">
          <span className="font-medium">{item.kind === "closed" ? "Cierre" : "Ocupado"}:</span> {timeFormatter.format(new Date(item.starts_at))} → {timeFormatter.format(new Date(item.ends_at))}
        </li>)}</ul>}
      <p className="mt-3 text-xs text-muted-foreground">Los tramos sin cruces también deben respetar el horario de la zona y pasar la validación al reservar. Las reservas de otros residentes se muestran sin datos personales.</p>
    </div>
  </section>;
}
