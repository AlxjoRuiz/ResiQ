"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const weekdays = ["L", "M", "X", "J", "V", "S", "D"];
const monthName = (month: string) => new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
const shortDate = (day: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
const addMonths = (month: string, amount: number) => { const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + amount, 1)); return date.toISOString().slice(0, 7); };
const addDays = (day: string, amount: number) => new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);

// Días del mes en cuadrícula de lunes a domingo (null = casilla vacía antes del día 1).
function monthGrid(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  return [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`)];
}

// Filtros del informe (28/10/2026): botón con ícono de calendario que abre un calendario pequeño. El
// primer clic marca «desde» y el segundo «hasta» (un solo día = dos clics en el mismo día). Hay atajos
// y el filtro de trabajador. Al pulsar «Ver informe» se recarga con ?desde=&hasta=&trabajador=.
export function ReportFilters({ from, to, today, workerId, workers }: { from: string; to: string; today: string; workerId: string | null; workers: { staff_id: string; name: string }[] }) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<{ from: string; to: string | null }>({ from, to });
  const [hover, setHover] = useState<string | null>(null);
  const [month, setMonth] = useState(to.slice(0, 7));
  const [worker, setWorker] = useState(workerId ?? "");

  // Se cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === "Escape" : !boxRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  function pick(day: string) {
    if (range.to !== null || day < range.from) setRange({ from: day, to: null });
    else { setRange({ from: range.from, to: day }); setOpen(false); }
  }
  function shortcut(nextFrom: string, nextTo: string) { setRange({ from: nextFrom, to: nextTo }); setMonth(nextTo.slice(0, 7)); setOpen(false); }
  function apply() {
    const end = range.to ?? range.from;
    router.push(`/mantenimiento/informe?${new URLSearchParams({ desde: range.from, hasta: end, ...(worker ? { trabajador: worker } : {}) })}`);
  }

  const end = range.to ?? (hover && hover >= range.from ? hover : range.from);
  const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const previousMonth = addMonths(today.slice(0, 7), -1);
  const shortcuts = [
    { label: "Hoy", from: today, to: today },
    { label: "Ayer", from: addDays(today, -1), to: addDays(today, -1) },
    { label: "Esta semana", from: monday, to: today },
    { label: "Este mes", from: `${today.slice(0, 7)}-01`, to: today },
    { label: "Mes pasado", from: `${previousMonth}-01`, to: addDays(`${today.slice(0, 7)}-01`, -1) },
  ];
  const label = range.to === null ? `${shortDate(range.from)} – elige el final` : range.from === range.to ? shortDate(range.from) : `${shortDate(range.from)} – ${shortDate(range.to)}`;

  return <div className="flex flex-wrap items-end gap-3">
    <div ref={boxRef} className="relative">
      <span className="block text-sm font-medium">Fechas</span>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" className="mt-1 flex h-11 items-center gap-2 rounded-lg border bg-white px-3 text-sm hover:bg-secondary"><CalendarDays size={18} aria-hidden="true" className="text-primary" />{label}</button>
      {open && <div role="dialog" aria-label="Elegir fechas del informe" className="absolute top-full left-0 z-20 mt-2 w-[19rem] rounded-2xl border bg-white p-3 shadow-lg">
        <div className="flex items-center justify-between"><button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior" className="flex size-9 items-center justify-center rounded-lg hover:bg-secondary"><ChevronLeft size={18} /></button><p className="text-sm font-semibold capitalize">{monthName(month)}</p><button type="button" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= today.slice(0, 7)} aria-label="Mes siguiente" className="flex size-9 items-center justify-center rounded-lg hover:bg-secondary disabled:opacity-30"><ChevronRight size={18} /></button></div>
        <div className="mt-2 grid grid-cols-7 text-center text-xs text-muted-foreground">{weekdays.map((day) => <span key={day} className="py-1">{day}</span>)}</div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-sm" onMouseLeave={() => setHover(null)}>{monthGrid(month).map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const future = day > today, edge = day === range.from || day === end, inside = day > range.from && day < end;
          return <button key={day} type="button" disabled={future} onClick={() => pick(day)} onMouseEnter={() => setHover(day)} aria-pressed={edge || inside} aria-label={shortDate(day)}
            className={`h-9 ${edge ? "rounded-lg bg-primary font-semibold text-white" : inside ? "bg-primary/12 text-primary" : "rounded-lg hover:bg-secondary"} ${day === today && !edge ? "font-semibold underline" : ""} disabled:cursor-not-allowed disabled:opacity-30`}>{Number(day.slice(8))}</button>;
        })}</div>
        <p className="mt-2 text-xs text-muted-foreground">{range.to === null ? "Ahora elige el día final." : "Toca un día para empezar otro rango."}</p>
        <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">{shortcuts.map((item) => <button key={item.label} type="button" onClick={() => shortcut(item.from, item.to)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-secondary">{item.label}</button>)}</div>
      </div>}
    </div>
    <label className="text-sm font-medium">Trabajador<select value={worker} onChange={(event) => setWorker(event.target.value)} className="mt-1 block h-11 rounded-lg border bg-white px-3 text-sm"><option value="">Todos</option>{workers.map((item) => <option key={item.staff_id} value={item.staff_id}>{item.name}</option>)}</select></label>
    <Button type="button" className="h-11" onClick={apply}>Ver informe</Button>
  </div>;
}
