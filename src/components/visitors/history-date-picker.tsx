"use client";

import { useCallback, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { CalendarPopover, colombiaToday, MonthCalendar, useCloseOnOutside, validDay } from "@/components/ui/calendar";

// Ícono de calendario para los historiales de portería (visitas y paquetes): al tocarlo se abre el calendario
// pequeño de ResiQ (mismo aspecto que Tareas, 29/10/2026) y, al elegir una fecha, la lista muestra desde ese
// día hasta hoy. Como antes, solo deja elegir hasta «max» (ayer).
export function HistoryDatePicker({ base, max, value }: { base: string; max: string; value?: string }) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((validDay(value) ? value : max).slice(0, 7));
  useCloseOnOutside(open, boxRef, useCallback(() => setOpen(false), []));

  return <div ref={boxRef} className="relative shrink-0">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" title="Buscar por fecha"
      className="inline-flex size-10 items-center justify-center rounded-full border bg-card text-primary hover:bg-muted">
      <CalendarDays size={18} aria-hidden="true" />
      <span className="sr-only">Buscar en el historial desde una fecha</span>
    </button>
    {open && <CalendarPopover label="Buscar en el historial desde una fecha" align="right">
      <MonthCalendar month={month} onMonthChange={setMonth} today={colombiaToday()} max={max} dayState={(day) => day === value ? "edge" : null}
        onPick={(day) => { setOpen(false); router.push(`${base}?vista=historial&fecha=${day}`); }} />
    </CalendarPopover>}
  </div>;
}
