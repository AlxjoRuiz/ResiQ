"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, addMonths, DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";

// Filtros de Tareas del admin (29/10/2026): estado, trabajador y fechas de la fecha límite con el mismo
// calendario del informe. Aquí sí se pueden elegir días futuros (las tareas vencen después) y «Todas las
// fechas» quita el filtro. Al pulsar «Ver» se recarga con ?estado=&trabajador=&desde=&hasta=.
export function TaskFilters({ status, workerId, range: initialRange, today, statuses, workers }: {
  status: string | null; workerId: string | null; range: DateRange | null; today: string;
  statuses: { value: string; label: string }[]; workers: { staffId: string; name: string }[];
}) {
  const router = useRouter();
  const [state, setState] = useState(status ?? "");
  const [worker, setWorker] = useState(workerId ?? "");
  const [range, setRange] = useState<DateRange | null>(initialRange);

  function apply() {
    const query = new URLSearchParams({ ...(state ? { estado: state } : {}), ...(worker ? { trabajador: worker } : {}), ...(range ? { desde: range.from, hasta: range.to } : {}) });
    router.push(`/mantenimiento/tareas${query.size ? `?${query}` : ""}`);
  }

  const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const nextMonth = addMonths(today.slice(0, 7), 1);
  const shortcuts = [
    { label: "Hoy", range: { from: today, to: today } },
    { label: "Esta semana", range: { from: monday, to: addDays(monday, 6) } },
    { label: "Este mes", range: { from: `${today.slice(0, 7)}-01`, to: addDays(`${nextMonth}-01`, -1) } },
    { label: "Próximo mes", range: { from: `${nextMonth}-01`, to: addDays(`${addMonths(nextMonth, 1)}-01`, -1) } },
    { label: "Todas las fechas", range: null },
  ];

  return <div className="mt-6 flex flex-wrap items-end gap-3">
    <label className="text-sm font-medium">Estado<select value={state} onChange={(event) => setState(event.target.value)} className="mt-1 block h-11 rounded-lg border bg-white px-3 text-sm">{statuses.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>
    <label className="text-sm font-medium">Trabajador<select value={worker} onChange={(event) => setWorker(event.target.value)} className="mt-1 block h-11 rounded-lg border bg-white px-3 text-sm"><option value="">Todos</option>{workers.map((item) => <option key={item.staffId} value={item.staffId}>{item.name}</option>)}</select></label>
    <DateRangePicker value={range} onChange={setRange} today={today} shortcuts={shortcuts} allowEmpty emptyLabel="Todas las fechas" dialogLabel="Elegir fechas límite" />
    <button type="button" onClick={apply} className="h-11 rounded-lg border bg-white px-4 text-sm font-medium hover:bg-secondary">Ver</button>
  </div>;
}
