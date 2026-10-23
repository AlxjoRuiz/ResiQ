"use client";

import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";

// Ícono de calendario para el historial de visitas: al tocarlo se abre el calendario del
// dispositivo y, al elegir una fecha, la lista muestra desde ese día hasta hoy.
export function HistoryDatePicker({ base, max, value }: { base: string; max: string; value?: string }) {
  const router = useRouter();
  return <label className="relative inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border bg-card text-primary hover:bg-muted" title="Buscar por fecha">
    <CalendarDays size={18} aria-hidden="true" />
    <span className="sr-only">Buscar visitas desde una fecha</span>
    {/* El campo cubre el ícono: en celular el toque abre el calendario nativo; en escritorio se abre con showPicker. */}
    <input type="date" max={max} defaultValue={value ?? ""} className="absolute inset-0 cursor-pointer opacity-0"
      onClick={(event) => { try { event.currentTarget.showPicker?.(); } catch { /* el navegador ya lo abrió */ } }}
      onChange={(event) => { if (event.target.value) router.push(`${base}?vista=historial&fecha=${event.target.value}`); }} />
  </label>;
}
