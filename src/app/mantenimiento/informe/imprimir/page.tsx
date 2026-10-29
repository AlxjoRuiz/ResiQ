import { loadReport, readReportFilters } from "@/lib/maintenance/report";
import { ReportCharts } from "@/components/maintenance/report-charts";
import { COLOMBIA_TIME_ZONE } from "@/lib/time-zone";
import { ReportView } from "../report-view";
import { PrintButton } from "./print-button";

// Vista para imprimir el informe (rango desde–hasta) o guardarlo como PDF desde el navegador.
// Desde el 29/10/2026 empieza con gráficas: horas, estado de tareas, asistencia y llamados.
export default async function MaintenanceReportPrintPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; trabajador?: string }> }) {
  const filters = readReportFilters(await searchParams);
  const report = await loadReport(filters);
  const generated = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: COLOMBIA_TIME_ZONE }).format(new Date());
  const worker = filters.workerId ? report.allWorkers.find((item) => item.staff_id === filters.workerId)?.name : null;
  return <main className="mx-auto min-h-screen max-w-5xl bg-white px-6 py-8 print:max-w-none print:p-0">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden"><p className="text-sm text-muted-foreground">En la ventana de impresión elige «Guardar como PDF» para descargarlo.</p><PrintButton /></div>
    <header className="border-b pb-4"><p className="text-xs font-semibold tracking-wider text-primary uppercase">ResiQ · Mantenimiento</p><h1 className="mt-1 text-2xl font-semibold">Informe de mantenimiento — <span className="first-letter:uppercase">{filters.label}</span></h1><p className="mt-1 text-sm text-muted-foreground">{worker ? `Trabajador: ${worker}` : "Todos los trabajadores"} · Generado el {generated} (hora de Colombia)</p></header>
    <ReportCharts summaries={report.summaries} attendance={report.attendance} from={filters.from} to={filters.to} />
    <ReportView report={report} detail />
  </main>;
}
