"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, addMonths, DateRangePicker, type DateRange } from "./date-range-picker";

// Filtro de fechas para las listas (29/10/2026): el calendario de rango de Tareas. Se aplica solo al
// terminar de elegir (segundo día o un atajo) y conserva los demás filtros de la dirección; vuelve a la
// primera página. «Todas las fechas» quita el filtro.
export function DateRangeFilter({ from, to, today, label = "Elegir fechas", allowFuture = false }: { from?: string; to?: string; today: string; label?: string; allowFuture?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function apply(range: DateRange | null) {
    const next = new URLSearchParams(params.toString());
    next.delete("pagina");
    if (range) { next.set("desde", range.from); next.set("hasta", range.to); } else { next.delete("desde"); next.delete("hasta"); }
    router.push(`${pathname}${next.size ? `?${next}` : ""}`);
  }

  const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const previousMonth = addMonths(today.slice(0, 7), -1), nextMonth = addMonths(today.slice(0, 7), 1);
  const shortcuts = [
    { label: "Hoy", range: { from: today, to: today } },
    { label: "Esta semana", range: { from: monday, to: allowFuture ? addDays(monday, 6) : today } },
    { label: "Este mes", range: { from: `${today.slice(0, 7)}-01`, to: allowFuture ? addDays(`${nextMonth}-01`, -1) : today } },
    { label: "Mes pasado", range: { from: `${previousMonth}-01`, to: addDays(`${today.slice(0, 7)}-01`, -1) } },
    ...(allowFuture ? [{ label: "Próximo mes", range: { from: `${nextMonth}-01`, to: addDays(`${addMonths(nextMonth, 1)}-01`, -1) } }] : []),
    { label: "Todas las fechas", range: null },
  ];

  return <DateRangePicker key={`${from ?? ""}|${to ?? ""}`} value={from && to ? { from, to } : null} onChange={() => {}} onCommit={apply} today={today} maxDate={allowFuture ? undefined : today}
    shortcuts={shortcuts} allowEmpty emptyLabel="Todas las fechas" dialogLabel={label} />;
}
