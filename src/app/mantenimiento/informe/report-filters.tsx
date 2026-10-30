"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addDays, addMonths, DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";

// Filtros del informe (28/10/2026): calendario pequeño de rango (compartido con Tareas), atajos y el
// filtro de trabajador. No deja elegir días futuros. Al pulsar «Ver informe» se recarga con
// ?desde=&hasta=&trabajador=.
export function ReportFilters({ from, to, today, workerId, workers }: { from: string; to: string; today: string; workerId: string | null; workers: { staff_id: string; name: string }[] }) {
  const router = useRouter();
  const [range, setRange] = useState<DateRange>({ from, to });
  const [worker, setWorker] = useState(workerId ?? "");

  function apply() {
    router.push(`/mantenimiento/informe?${new URLSearchParams({ desde: range.from, hasta: range.to, ...(worker ? { trabajador: worker } : {}) })}`);
  }

  const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const previousMonth = addMonths(today.slice(0, 7), -1);
  const shortcuts = [
    { label: "Hoy", range: { from: today, to: today } },
    { label: "Ayer", range: { from: addDays(today, -1), to: addDays(today, -1) } },
    { label: "Esta semana", range: { from: monday, to: today } },
    { label: "Este mes", range: { from: `${today.slice(0, 7)}-01`, to: today } },
    { label: "Mes pasado", range: { from: `${previousMonth}-01`, to: addDays(`${today.slice(0, 7)}-01`, -1) } },
  ];

  return <div className="flex flex-wrap items-end gap-3">
    <DateRangePicker value={range} onChange={(next) => { if (next) setRange(next); }} today={today} maxDate={today} shortcuts={shortcuts} dialogLabel="Elegir fechas del informe" />
    <label className="text-sm font-medium">Trabajador<select value={worker} onChange={(event) => setWorker(event.target.value)} className="mt-1 block h-11 rounded-lg border bg-white px-3 text-sm"><option value="">Todos</option>{workers.map((item) => <option key={item.staff_id} value={item.staff_id}>{item.name}</option>)}</select></label>
    <Button type="button" className="h-11" onClick={apply}>Ver informe</Button>
  </div>;
}
