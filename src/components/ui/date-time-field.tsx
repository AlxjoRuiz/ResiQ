"use client";

import { useCallback, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { CalendarPopover, CalendarTrigger, colombiaToday, MonthCalendar, useCloseOnOutside, validDay } from "./calendar";

// Fecha y hora con el aspecto del calendario de ResiQ (29/10/2026). Antes abría el selector del
// sistema (<input type="datetime-local">); la función es la misma: envía el mismo nombre con el valor
// AAAA-MM-DDTHH:MM (hora local de la propiedad, sin zona), es obligatorio y acepta valor controlado
// (value + onChange) o inicial (defaultValue). El valor solo se completa cuando hay día y hora.
const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const selectClass = "h-10 min-w-0 flex-1 rounded-lg border bg-white px-2 text-sm";
const parse = (value: string) => /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);

function TimeSelects({ hour, minute, onChange }: { hour: string; minute: string; onChange: (hour: string, minute: string) => void }) {
  return <div className="flex items-center gap-2">
    <select aria-label="Hora" value={hour} onChange={(event) => onChange(event.target.value, minute)} className={selectClass}><option value="" disabled>Hora</option>{hours.map((item) => <option key={item} value={item}>{item}</option>)}</select>
    <span aria-hidden="true" className="font-semibold">:</span>
    <select aria-label="Minutos" value={minute} onChange={(event) => onChange(hour, event.target.value)} className={selectClass}><option value="" disabled>Min</option>{minutes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
  </div>;
}

export function DateTimeField({ name, label, value, defaultValue, onChange, required = true }: {
  name: string; label: string; value?: string; defaultValue?: string; onChange?: (value: string) => void; required?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState(defaultValue ?? "");
  const current = value ?? own;
  const parts = parse(current);
  // Día u hora elegidos mientras el valor todavía está incompleto.
  const [draft, setDraft] = useState({ day: "", hour: "", minute: "" });
  const day = parts?.[1] ?? draft.day, hour = parts?.[2] ?? draft.hour, minute = parts?.[3] ?? draft.minute;
  const today = colombiaToday();
  const [month, setMonth] = useState((validDay(day) ? day : today).slice(0, 7));
  const [invalid, setInvalid] = useState(false);
  useCloseOnOutside(open, boxRef, useCallback(() => setOpen(false), []));

  function update(next: { day: string; hour: string; minute: string }) {
    setDraft(next);
    const complete = next.day && next.hour && next.minute ? `${next.day}T${next.hour}:${next.minute}` : "";
    if (value === undefined) setOwn(complete);
    onChange?.(complete);
    if (complete) setInvalid(false);
  }

  const display = parts ? `${current.slice(8, 10)}/${current.slice(5, 7)}/${current.slice(0, 4)} · ${current.slice(11, 16)}` : undefined;
  return <div ref={boxRef} className="relative block min-w-0 text-sm font-medium">
    <span id={`${name}-etiqueta`}>{label}</span>
    <CalendarTrigger open={open} onClick={() => { if (!open && validDay(day)) setMonth(day.slice(0, 7)); setOpen(!open); }} invalid={invalid} placeholder="Selecciona fecha y hora" className="mt-2">{display}</CalendarTrigger>
    <input tabIndex={-1} aria-hidden="true" name={name} value={current} required={required} onChange={() => {}} onInvalid={() => setInvalid(true)} className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0" />
    {open && <CalendarPopover label={label}>
      <MonthCalendar month={month} onMonthChange={setMonth} today={today} onPick={(picked) => update({ day: picked, hour, minute })} dayState={(item) => item === day ? "edge" : null} />
      <div className="mt-3 border-t pt-3"><p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 size={14} aria-hidden="true" />Hora (24 horas)</p>
        <TimeSelects hour={hour} minute={minute} onChange={(nextHour, nextMinute) => update({ day, hour: nextHour, minute: nextMinute })} /></div>
      <div className="mt-3 flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{!day ? "Elige el día." : !hour || !minute ? "Elige la hora." : "Listo."}</p><button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border px-3 text-sm font-medium hover:bg-secondary">Listo</button></div>
    </CalendarPopover>}
  </div>;
}

// Solo hora (HH:MM) con el mismo aspecto; reemplaza a <input type="time">. Envía el mismo nombre y valor.
export function TimeField({ name, label, required = true, className }: { name: string; label: string; required?: boolean; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState({ hour: "", minute: "" });
  const [invalid, setInvalid] = useState(false);
  useCloseOnOutside(open, boxRef, useCallback(() => setOpen(false), []));
  const value = time.hour && time.minute ? `${time.hour}:${time.minute}` : "";
  return <div ref={boxRef} className={`relative min-w-0 ${className ?? ""}`}>
    <CalendarTrigger open={open} onClick={() => setOpen(!open)} invalid={invalid} placeholder="Selecciona la hora" className="mt-2 text-base sm:text-sm" icon={Clock3}>{value || undefined}</CalendarTrigger>
    <input tabIndex={-1} aria-hidden="true" name={name} value={value} required={required} onChange={() => {}} onInvalid={() => setInvalid(true)} className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0" />
    {open && <CalendarPopover label={label}>
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 size={14} aria-hidden="true" />Hora (24 horas)</p>
      <TimeSelects hour={time.hour} minute={time.minute} onChange={(hour, minute) => { setTime({ hour, minute }); if (hour && minute) setInvalid(false); }} />
      <div className="mt-3 flex justify-end"><button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border px-3 text-sm font-medium hover:bg-secondary">Listo</button></div>
    </CalendarPopover>}
  </div>;
}
