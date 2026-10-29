import { loadMonthlyReport, monthLabel, readReportFilters } from "@/lib/maintenance/report";
import { COLOMBIA_TIME_ZONE } from "@/lib/time-zone";
import { ReportView } from "../report-view";
import { PrintButton } from "./print-button";

// Vista para imprimir el informe mensual o guardarlo como PDF desde el navegador (entrega 6).
export default async function MaintenanceReportPrintPage({ searchParams }: { searchParams: Promise<{ mes?: string; trabajador?: string }> }) {
  const { month, workerId } = readReportFilters(await searchParams);
  const report = await loadMonthlyReport(month, workerId);
  const generated = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: COLOMBIA_TIME_ZONE }).format(new Date());
  const worker = workerId ? report.allWorkers.find((item) => item.staff_id === workerId)?.name : null;
  return <main className="mx-auto min-h-screen max-w-5xl bg-white px-6 py-8 print:max-w-none print:p-0">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden"><p className="text-sm text-muted-foreground">En la ventana de impresión elige «Guardar como PDF» para descargarlo.</p><PrintButton /></div>
    <header className="border-b pb-4"><p className="text-xs font-semibold tracking-wider text-primary uppercase">ResiQ · Mantenimiento</p><h1 className="mt-1 text-2xl font-semibold">Informe mensual — <span className="capitalize">{monthLabel(month)}</span></h1><p className="mt-1 text-sm text-muted-foreground">{worker ? `Trabajador: ${worker}` : "Todos los trabajadores"} · Generado el {generated} (hora de Colombia)</p></header>
    <ReportView report={report} detail />
  </main>;
}
