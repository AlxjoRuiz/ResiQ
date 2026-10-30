"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, CalendarPopover, CalendarTrigger, colombiaToday, fixedBelow, MonthCalendar, shortDate, useCloseOnOutside, validDay } from "./calendar";

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const selectClass = "h-9 min-w-0 rounded-lg border bg-white px-2 text-sm";

// Campo de un solo día con el aspecto del calendario de Tareas e Informe (29/10/2026). Reemplaza a
// <input type="date"> sin cambiar su función: envía el mismo nombre y valor (YYYY-MM-DD) en el
// formulario, respeta required, min y max, y acepta valor inicial (defaultValue) o controlado
// (value + onChange). Un campo oculto conserva la validación del navegador.
// yearSelect: selectores de mes y año arriba (fechas de nacimiento, para no avanzar mes a mes).
// floating: el calendario flota por encima de todo (dentro de listas con desplazamiento propio) y se
// cierra si la página se desplaza. className ajusta el botón al estilo de cada formulario.
export function DatePicker({ name, value, defaultValue, onChange, min, max, required, disabled, placeholder = "Selecciona la fecha", label, id, yearSelect = false, initialMonth, align, floating = false, className }: {
  name?: string; value?: string; defaultValue?: string; onChange?: (value: string) => void; min?: string; max?: string;
  required?: boolean; disabled?: boolean; placeholder?: string; label?: string; id?: string; yearSelect?: boolean; initialMonth?: string; align?: "left" | "right";
  floating?: boolean; className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | undefined>();
  useEffect(() => {
    if (!open || !floating) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true); window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open, floating]);
  const [own, setOwn] = useState(defaultValue ?? "");
  const [invalid, setInvalid] = useState(false);
  const current = value ?? own;
  const today = colombiaToday();
  const [month, setMonth] = useState((validDay(current) ? current : initialMonth ?? (max && max < today ? max : min && min > today ? min : today)).slice(0, 7));
  useCloseOnOutside(open, boxRef, useCallback(() => setOpen(false), []));

  function pick(day: string) {
    if (value === undefined) setOwn(day);
    onChange?.(day); setInvalid(false); setOpen(false);
  }
  function toggle() {
    // Al abrir, el calendario muestra el mes del día elegido.
    if (!open && validDay(current)) setMonth(current.slice(0, 7));
    if (!open && floating) setPosition(fixedBelow(boxRef.current));
    setOpen(!open);
  }

  const firstYear = Number((min ?? "1920-01-01").slice(0, 4)), lastYear = Number((max ?? addMonths(today.slice(0, 7), 120)).slice(0, 4));
  const header = yearSelect ? <div className="flex min-w-0 gap-1">
    <select aria-label="Mes" value={month.slice(5, 7)} onChange={(event) => setMonth(`${month.slice(0, 4)}-${event.target.value}`)} className={selectClass}>{monthNames.map((nameOfMonth, index) => <option key={nameOfMonth} value={String(index + 1).padStart(2, "0")}>{nameOfMonth}</option>)}</select>
    <select aria-label="Año" value={month.slice(0, 4)} onChange={(event) => setMonth(`${event.target.value}-${month.slice(5, 7)}`)} className={selectClass}>{Array.from({ length: lastYear - firstYear + 1 }, (_, index) => String(lastYear - index)).map((year) => <option key={year} value={year}>{year}</option>)}</select>
  </div> : undefined;

  return <div ref={boxRef} className="relative min-w-0">
    <CalendarTrigger id={id} open={open} onClick={toggle} disabled={disabled} invalid={invalid} placeholder={placeholder} className={className}>{validDay(current) ? shortDate(current) : undefined}</CalendarTrigger>
    {(name || required) && <input tabIndex={-1} aria-hidden="true" name={name} value={current} required={required} onChange={() => {}} onInvalid={() => setInvalid(true)}
      className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0" />}
    {open && <CalendarPopover label={label ?? "Elegir fecha"} align={align} style={floating ? position : undefined}>
      <MonthCalendar month={month} onMonthChange={setMonth} today={today} min={min} max={max} onPick={pick} header={header} dayState={(day) => day === current ? "edge" : null} />
    </CalendarPopover>}
  </div>;
}

// Mes (YYYY-MM) con el mismo aspecto: rejilla de los 12 meses y flechas de año. Reemplaza a <input type="month">.
export function MonthPicker({ name, value, onChange, min, max, required, disabled, placeholder = "Selecciona el mes", label, className }: {
  name?: string; value: string; onChange: (value: string) => void; min?: string; max?: string; required?: boolean; disabled?: boolean; placeholder?: string; label?: string; className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number((value || colombiaToday()).slice(0, 4)));
  useCloseOnOutside(open, boxRef, useCallback(() => setOpen(false), []));
  const display = /^\d{4}-\d{2}$/.test(value) ? `${monthNames[Number(value.slice(5, 7)) - 1]} de ${value.slice(0, 4)}` : undefined;

  return <div ref={boxRef} className="relative min-w-0">
    <CalendarTrigger open={open} onClick={() => setOpen(!open)} disabled={disabled} placeholder={placeholder} className={className}>{display}</CalendarTrigger>
    {(name || required) && <input tabIndex={-1} aria-hidden="true" name={name} value={value} required={required} onChange={() => {}} className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0" />}
    {open && <CalendarPopover label={label ?? "Elegir mes"}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setYear(year - 1)} disabled={min !== undefined && year <= Number(min.slice(0, 4))} aria-label="Año anterior" className="flex size-9 items-center justify-center rounded-lg hover:bg-secondary disabled:opacity-30"><ChevronLeft size={18} /></button>
        <p className="text-sm font-semibold">{year}</p>
        <button type="button" onClick={() => setYear(year + 1)} disabled={max !== undefined && year >= Number(max.slice(0, 4))} aria-label="Año siguiente" className="flex size-9 items-center justify-center rounded-lg hover:bg-secondary disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">{monthNames.map((nameOfMonth, index) => {
        const key = `${year}-${String(index + 1).padStart(2, "0")}`;
        const blocked = (min !== undefined && key < min.slice(0, 7)) || (max !== undefined && key > max.slice(0, 7));
        return <button key={key} type="button" disabled={blocked} onClick={() => { onChange(key); setOpen(false); }} aria-pressed={key === value}
          className={`h-10 rounded-lg text-sm ${key === value ? "bg-primary font-semibold text-white" : "hover:bg-secondary"} disabled:cursor-not-allowed disabled:opacity-30`}>{nameOfMonth.slice(0, 3)}</button>;
      })}</div>
    </CalendarPopover>}
  </div>;
}
