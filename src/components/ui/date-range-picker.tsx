"use client";

import { useCallback, useRef, useState } from "react";
import { CalendarPopover, CalendarTrigger, MonthCalendar, shortDate, useCloseOnOutside } from "./calendar";

export { addDays, addMonths, shortDate } from "./calendar";

export type DateRange = { from: string; to: string };
type Shortcut = { label: string; range: DateRange | null };

// Calendario pequeño de rango (28/10/2026 en el informe; compartido con Tareas el 29/10/2026): botón con
// ícono que abre el calendario. El primer clic marca «desde» y el segundo «hasta» (un solo día = dos
// clics en el mismo día). maxDate limita los días que se pueden elegir; los atajos con range null quitan
// el filtro de fechas (solo si allowEmpty). onCommit avisa cuando el rango quedó completo (segundo día
// o un atajo), para filtros que se aplican solos.
export function DateRangePicker({ value, onChange, onCommit, today, maxDate, shortcuts, allowEmpty = false, emptyLabel = "Todas las fechas", dialogLabel = "Elegir fechas" }: {
  value: DateRange | null; onChange: (range: DateRange | null) => void; onCommit?: (range: DateRange | null) => void; today: string; maxDate?: string;
  shortcuts: Shortcut[]; allowEmpty?: boolean; emptyLabel?: string; dialogLabel?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Rango en edición: «to» null mientras falta el segundo clic.
  const [draft, setDraft] = useState<{ from: string; to: string | null } | null>(value);
  const [hover, setHover] = useState<string | null>(null);
  const [month, setMonth] = useState((value?.to ?? today).slice(0, 7));
  useCloseOnOutside(open, boxRef, useCallback(() => setOpen(false), []));

  function pick(day: string) {
    if (!draft || draft.to !== null || day < draft.from) { setDraft({ from: day, to: null }); onChange({ from: day, to: day }); }
    else { setDraft({ from: draft.from, to: day }); onChange({ from: draft.from, to: day }); onCommit?.({ from: draft.from, to: day }); setOpen(false); }
  }
  function shortcut(range: DateRange | null) { setDraft(range); onChange(range); onCommit?.(range); if (range) setMonth(range.to.slice(0, 7)); setOpen(false); }

  const end = draft ? draft.to ?? (hover && hover >= draft.from ? hover : draft.from) : null;
  const label = !draft ? emptyLabel : draft.to === null ? `${shortDate(draft.from)} – elige el final` : draft.from === draft.to ? shortDate(draft.from) : `${shortDate(draft.from)} – ${shortDate(draft.to)}`;

  return <div ref={boxRef} className="relative">
    <span className="block text-sm font-medium">Fechas</span>
    <div className="w-fit max-w-full"><CalendarTrigger open={open} onClick={() => setOpen(!open)}>{label}</CalendarTrigger></div>
    {open && <CalendarPopover label={dialogLabel}>
      <MonthCalendar month={month} onMonthChange={setMonth} today={today} max={maxDate} onPick={pick} onHover={setHover}
        dayState={(day) => !draft || !end ? null : day === draft.from || day === end ? "edge" : day > draft.from && day < end ? "inside" : null} />
      <p className="mt-2 text-xs text-muted-foreground">{draft?.to === null ? "Ahora elige el día final." : "Toca un día para empezar otro rango."}</p>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">{shortcuts.filter((item) => allowEmpty || item.range).map((item) => <button key={item.label} type="button" onClick={() => shortcut(item.range)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-secondary">{item.label}</button>)}</div>
    </CalendarPopover>}
  </div>;
}
