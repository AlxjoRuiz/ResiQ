"use client";

import { useEffect, type CSSProperties, type ReactNode, type RefObject } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Piezas del calendario pequeño de ResiQ (29/10/2026): el mismo aspecto en Informe, Tareas y todos los
// campos de fecha. Fechas como texto YYYY-MM-DD (sin zona horaria) para no correrse un día.
const weekdays = ["L", "M", "X", "J", "V", "S", "D"];
export const monthName = (month: string) => new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
export const shortDate = (day: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
export const addMonths = (month: string, amount: number) => { const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + amount, 1)); return date.toISOString().slice(0, 7); };
export const addDays = (day: string, amount: number) => new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
export const validDay = (value: string | null | undefined): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
// «Hoy» en Colombia, calculado en el navegador.
export const colombiaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

// Días del mes en cuadrícula de lunes a domingo (null = casilla vacía antes del día 1).
function monthGrid(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  return [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`)];
}

// Cierra el calendario al hacer clic fuera de su caja o con Escape.
export function useCloseOnOutside(open: boolean, boxRef: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === "Escape" : !boxRef.current?.contains(event.target as Node)) close(); };
    document.addEventListener("mousedown", handle); document.addEventListener("keydown", handle);
    return () => { document.removeEventListener("mousedown", handle); document.removeEventListener("keydown", handle); };
  }, [open, boxRef, close]);
}

// Botón que abre el calendario: ícono a la izquierda y la fecha elegida (o el texto de ayuda).
// className ajusta el espaciado o la altura para alinearse con los demás campos de cada formulario.
export function CalendarTrigger({ open, onClick, children, placeholder, invalid, disabled, id, className }: { open: boolean; onClick: () => void; children?: ReactNode; placeholder?: string; invalid?: boolean; disabled?: boolean; id?: string; className?: string }) {
  return <button id={id} type="button" onClick={onClick} disabled={disabled} aria-expanded={open} aria-haspopup="dialog"
    className={cn("mt-1 flex h-11 w-full min-w-0 items-center gap-2 rounded-lg border bg-white px-3 text-left text-sm font-normal text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60", invalid && "border-destructive", className)}>
    <CalendarDays size={18} aria-hidden="true" className="shrink-0 text-primary" />
    <span className={`min-w-0 truncate ${children ? "" : "text-muted-foreground"}`}>{children ?? placeholder}</span>
  </button>;
}

// Caja flotante del calendario, debajo del botón. Con style (posición fija calculada) flota por encima de
// listas con desplazamiento propio que, si no, la recortarían.
export function CalendarPopover({ label, children, align = "left", style }: { label: string; children: ReactNode; align?: "left" | "right"; style?: CSSProperties }) {
  return <div role="dialog" aria-label={label} style={style} className={cn("z-30 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border bg-white p-3 text-sm font-normal text-foreground shadow-lg", style ? "fixed" : "absolute top-full mt-2", !style && (align === "right" ? "right-0" : "left-0"))}>{children}</div>;
}

// Posición fija para el calendario justo debajo de su botón, sin salirse de la pantalla.
export function fixedBelow(element: HTMLElement | null): CSSProperties | undefined {
  if (!element) return undefined;
  const box = element.getBoundingClientRect();
  return { top: box.bottom + 8, left: Math.max(16, Math.min(box.left, window.innerWidth - 320)) };
}

// Un mes: título con flechas (o el encabezado que se pase, p. ej. selectores de año) y la cuadrícula.
export function MonthCalendar({ month, onMonthChange, today, min, max, dayState, onPick, onHover, header }: {
  month: string; onMonthChange: (month: string) => void; today: string; min?: string; max?: string;
  dayState: (day: string) => "edge" | "inside" | null; onPick: (day: string) => void; onHover?: (day: string | null) => void; header?: ReactNode;
}) {
  return <>
    <div className="flex items-center justify-between gap-1">
      <button type="button" onClick={() => onMonthChange(addMonths(month, -1))} disabled={min !== undefined && month <= min.slice(0, 7)} aria-label="Mes anterior" className="flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-secondary disabled:opacity-30"><ChevronLeft size={18} /></button>
      {header ?? <p className="text-sm font-semibold capitalize">{monthName(month)}</p>}
      <button type="button" onClick={() => onMonthChange(addMonths(month, 1))} disabled={max !== undefined && month >= max.slice(0, 7)} aria-label="Mes siguiente" className="flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-secondary disabled:opacity-30"><ChevronRight size={18} /></button>
    </div>
    <div className="mt-2 grid grid-cols-7 text-center text-xs text-muted-foreground">{weekdays.map((day) => <span key={day} className="py-1">{day}</span>)}</div>
    <div className="grid grid-cols-7 gap-y-1 text-center text-sm" onMouseLeave={() => onHover?.(null)}>{monthGrid(month).map((day, index) => {
      if (!day) return <span key={`empty-${index}`} />;
      const blocked = (min !== undefined && day < min) || (max !== undefined && day > max);
      const state = dayState(day);
      return <button key={day} type="button" disabled={blocked} onClick={() => onPick(day)} onMouseEnter={() => onHover?.(day)} aria-pressed={state !== null} aria-label={shortDate(day)}
        className={`h-9 ${state === "edge" ? "rounded-lg bg-primary font-semibold text-white" : state === "inside" ? "bg-primary/12 text-primary" : "rounded-lg hover:bg-secondary"} ${day === today && state !== "edge" ? "font-semibold underline" : ""} disabled:cursor-not-allowed disabled:opacity-30`}>{Number(day.slice(8))}</button>;
    })}</div>
  </>;
}
