"use client";

import { useCallback, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, CalendarPopover, CalendarTrigger, MonthCalendar, shortDate, useCloseOnOutside } from "@/components/ui/calendar";

// Periodo del informe jurídico (12/11/2026): el mismo calendario del resto de ResiQ, con tres formas de elegir:
// un mes, de un mes a otro, o de un día a otro. Al terminar de elegir abre el informe de ese periodo.
type Mode = "month" | "months" | "days";
const modes: { key: Mode; label: string }[] = [{ key: "month", label: "Un mes" }, { key: "months", label: "Mes a mes" }, { key: "days", label: "Día a día" }];
const monthShort = (month: string) => new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`)).replace(".", "");
const lastDay = (month: string) => addDays(`${addMonths(month, 1)}-01`, -1);

export function PeriodPicker({ label, today, firstMonth, initialMode, from, to }: { label: string; today: string; firstMonth: string | null; initialMode: Mode; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [year, setYear] = useState(Number(to.slice(0, 4)));
  const [month, setMonth] = useState(to.slice(0, 7));
  // Rango en edición: «end» null mientras falta el segundo clic.
  const [draft, setDraft] = useState<{ start: string; end: string | null } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  useCloseOnOutside(open, boxRef, useCallback(() => setOpen(false), []));
  const thisMonth = today.slice(0, 7);
  const minMonth = firstMonth?.slice(0, 7) ?? null;

  function go(query: string) { setOpen(false); setDraft(null); router.push(`${pathname}?${query}`); }
  function changeMode(next: Mode) { setMode(next); setDraft(null); setHover(null); }
  function pickMonth(value: string) {
    if (mode === "month") return go(`mes=${value}`);
    if (!draft || draft.end !== null || value < draft.start) return setDraft({ start: value, end: null });
    go(draft.start === value ? `mes=${value}` : `desde=${draft.start}-01&hasta=${lastDay(value)}`);
  }
  function pickDay(day: string) {
    if (!draft || draft.end !== null || day < draft.start) return setDraft({ start: day, end: null });
    go(`desde=${draft.start}&hasta=${day}`);
  }

  const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  const end = draft ? draft.end ?? (hover && hover >= draft.start ? hover : draft.start) : null;
  const monthState = (value: string) => mode === "month" ? (value === from.slice(0, 7) && initialMode === "month" ? "edge" : null)
    : draft && end ? (value === draft.start || value === end ? "edge" : value > draft.start && value < end ? "inside" : null) : null;
  const hint = draft?.end === null ? (mode === "days" ? `Desde ${shortDate(draft.start)}: ahora elige el día final.` : "Ahora elige el mes final.") : mode === "month" ? "Elige el mes del informe." : mode === "months" ? "Elige el mes inicial y luego el final." : "Elige el día inicial y luego el final.";

  return <div ref={boxRef} className="relative">
    <span className="block text-xs font-medium text-slate-600">Periodo</span>
    <div className="w-72 max-w-full"><CalendarTrigger open={open} onClick={() => setOpen(!open)} className="h-11 rounded-xl">{label}</CalendarTrigger></div>
    {open && <CalendarPopover label="Elegir periodo del informe" align="right">
      <div role="tablist" aria-label="Forma de elegir el periodo" className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
        {modes.map((item) => <button key={item.key} type="button" role="tab" aria-selected={mode === item.key} onClick={() => changeMode(item.key)} className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${mode === item.key ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-foreground"}`}>{item.label}</button>)}
      </div>
      {mode === "days" ? <MonthCalendar month={month} onMonthChange={setMonth} today={today} max={today} min={firstMonth ?? undefined} onPick={pickDay} onHover={setHover}
          dayState={(day) => !draft || !end ? null : day === draft.start || day === end ? "edge" : day > draft.start && day < end ? "inside" : null} />
        : <>
          <div className="flex items-center justify-between gap-1">
            <button type="button" onClick={() => setYear(year - 1)} disabled={minMonth !== null && `${year}-01` <= minMonth} aria-label="Año anterior" className="flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-secondary disabled:opacity-30"><ChevronLeft size={18} /></button>
            <p className="text-sm font-semibold">{year}</p>
            <button type="button" onClick={() => setYear(year + 1)} disabled={`${year}-12` >= thisMonth} aria-label="Año siguiente" className="flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-secondary disabled:opacity-30"><ChevronRight size={18} /></button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-center text-sm" onMouseLeave={() => setHover(null)}>{months.map((value) => {
            const blocked = value > thisMonth || (minMonth !== null && value < minMonth);
            const state = monthState(value);
            return <button key={value} type="button" disabled={blocked} onClick={() => pickMonth(value)} onMouseEnter={() => setHover(value)} aria-pressed={state !== null}
              className={`h-10 capitalize ${state === "edge" ? "rounded-lg bg-primary font-semibold text-white" : state === "inside" ? "bg-primary/12 text-primary" : "rounded-lg hover:bg-secondary"} ${value === thisMonth && state !== "edge" ? "font-semibold underline" : ""} disabled:cursor-not-allowed disabled:opacity-30`}>{monthShort(value)}</button>;
          })}</div>
        </>}
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
        <button type="button" onClick={() => go(`mes=${thisMonth}`)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-secondary">Este mes</button>
        <button type="button" onClick={() => go(`mes=${addMonths(thisMonth, -1)}`)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-secondary">Mes pasado</button>
        <button type="button" onClick={() => go(`desde=${addMonths(thisMonth, -2)}-01&hasta=${today}`)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-secondary">Últimos 3 meses</button>
      </div>
    </CalendarPopover>}
  </div>;
}
