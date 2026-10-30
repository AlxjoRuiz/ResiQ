"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const weekdays = ["L", "M", "X", "J", "V", "S", "D"];
const monthName = (month: string) => new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
export const shortDate = (day: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
export const addMonths = (month: string, amount: number) => { const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + amount, 1)); return date.toISOString().slice(0, 7); };
export const addDays = (day: string, amount: number) => new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);

// Días del mes en cuadrícula de lunes a domingo (null = casilla vacía antes del día 1).
function monthGrid(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  return [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`)];
}

export type DateRange = { from: string; to: string };
type Shortcut = { label: string; range: DateRange | null };

// Calendario pequeño de rango (28/10/2026 en el informe; compartido con Tareas el 29/10/2026): botón con
// ícono que abre el calendario. El primer clic marca «desde» y el segundo «hasta» (un solo día = dos
// clics en el mismo día). maxDate limita los días que se pueden elegir; los atajos con range null quitan
// el filtro de fechas (solo si allowEmpty).
export function DateRangePicker({ value, onChange, today, maxDate, shortcuts, allowEmpty = false, emptyLabel = "Todas las fechas", dialogLabel = "Elegir fechas" }: {
  value: DateRange | null; onChange: (range: DateRange | null) => void; today: string; maxDate?: string;
  shortcuts: Shortcut[]; allowEmpty?: boolean; emptyLabel?: string; dialogLabel?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Rango en edición: «to» null mientras falta el segundo clic.
  const [draft, setDraft] = useState<{ from: string; to: string | null } | null>(value);
  const [hover, setHover] = useState<string | null>(null);
  const [month, setMonth] = useState((value?.to ?? today).slice(0, 7));

  // Se cierra al hacer clic fuera o con Escape; si quedó a medias, vale como un solo día.
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === "Escape" : !boxRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  function pick(day: string) {
    if (!draft || draft.to !== null || day < draft.from) { setDraft({ from: day, to: null }); onChange({ from: day, to: day }); }
    else { setDraft({ from: draft.from, to: day }); onChange({ from: draft.from, to: day }); setOpen(false); }
  }
  function shortcut(range: DateRange | null) { setDraft(range); onChange(range); if (range) setMonth(range.to.slice(0, 7)); setOpen(false); }

  const end = draft ? draft.to ?? (hover && hover >= draft.from ? hover : draft.from) : null;
  const label = !draft ? emptyLabel : draft.to === null ? `${shortDate(draft.from)} – elige el final` : draft.from === draft.to ? shortDate(draft.from) : `${shortDate(draft.from)} – ${shortDate(draft.to)}`;

  return <div ref={boxRef} className="relative">
    <span className="block text-sm font-medium">Fechas</span>
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" className="mt-1 flex h-11 items-center gap-2 rounded-lg border bg-white px-3 text-sm hover:bg-secondary"><CalendarDays size={18} aria-hidden="true" className="text-primary" />{label}</button>
    {open && <div role="dialog" aria-label={dialogLabel} className="absolute top-full left-0 z-20 mt-2 w-[19rem] rounded-2xl border bg-white p-3 shadow-lg">
      <div className="flex items-center justify-between"><button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior" className="flex size-9 items-center justify-center rounded-lg hover:bg-secondary"><ChevronLeft size={18} /></button><p className="text-sm font-semibold capitalize">{monthName(month)}</p><button type="button" onClick={() => setMonth(addMonths(month, 1))} disabled={maxDate !== undefined && month >= maxDate.slice(0, 7)} aria-label="Mes siguiente" className="flex size-9 items-center justify-center rounded-lg hover:bg-secondary disabled:opacity-30"><ChevronRight size={18} /></button></div>
      <div className="mt-2 grid grid-cols-7 text-center text-xs text-muted-foreground">{weekdays.map((day) => <span key={day} className="py-1">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-sm" onMouseLeave={() => setHover(null)}>{monthGrid(month).map((day, index) => {
        if (!day) return <span key={`empty-${index}`} />;
        const blocked = maxDate !== undefined && day > maxDate;
        const edge = !!draft && (day === draft.from || day === end), inside = !!draft && !!end && day > draft.from && day < end;
        return <button key={day} type="button" disabled={blocked} onClick={() => pick(day)} onMouseEnter={() => setHover(day)} aria-pressed={edge || inside} aria-label={shortDate(day)}
          className={`h-9 ${edge ? "rounded-lg bg-primary font-semibold text-white" : inside ? "bg-primary/12 text-primary" : "rounded-lg hover:bg-secondary"} ${day === today && !edge ? "font-semibold underline" : ""} disabled:cursor-not-allowed disabled:opacity-30`}>{Number(day.slice(8))}</button>;
      })}</div>
      <p className="mt-2 text-xs text-muted-foreground">{draft?.to === null ? "Ahora elige el día final." : "Toca un día para empezar otro rango."}</p>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">{shortcuts.filter((item) => allowEmpty || item.range).map((item) => <button key={item.label} type="button" onClick={() => shortcut(item.range)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-secondary">{item.label}</button>)}</div>
    </div>}
  </div>;
}
