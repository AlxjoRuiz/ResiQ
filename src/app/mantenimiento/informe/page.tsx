import Link from "next/link";
import { FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { currentMonth, loadMonthlyReport, monthLabel, readReportFilters } from "@/lib/maintenance/report";
import { ReportView } from "./report-view";

// Informe mensual (entrega 6): solo el admin de mantenimiento. Se filtra por mes y trabajador y se
// descarga en Excel o se abre la vista para imprimir / guardar como PDF.
export default async function MaintenanceReportPage({ searchParams }: { searchParams: Promise<{ mes?: string; trabajador?: string }> }) {
  const { month, workerId } = readReportFilters(await searchParams);
  const report = await loadMonthlyReport(month, workerId);
  const query = new URLSearchParams({ mes: month, ...(workerId ? { trabajador: workerId } : {}) }).toString();
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-7 sm:px-10">
    <Link href="/mantenimiento" className="text-sm text-muted-foreground hover:text-foreground">← Volver a mantenimiento</Link>
    <header className="mt-5 border-b pb-5"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Mantenimiento</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Informe mensual</h1><p className="mt-2 text-sm text-muted-foreground">Asistencia, tareas y llamados de atención del mes, en hora de Colombia.</p></header>
    <Card className="mt-6"><CardContent>
      <form className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Mes<input name="mes" type="month" defaultValue={month} max={currentMonth()} className="mt-1 block h-11 rounded-lg border bg-white px-3 text-sm" /></label>
        <label className="text-sm font-medium">Trabajador<select name="trabajador" defaultValue={workerId ?? ""} className="mt-1 block h-11 rounded-lg border bg-white px-3 text-sm"><option value="">Todos</option>{report.allWorkers.map((worker) => <option key={worker.staff_id} value={worker.staff_id}>{worker.name}</option>)}</select></label>
        <button className="h-11 rounded-lg border bg-white px-4 text-sm font-medium hover:bg-secondary">Ver</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
        <Button asChild><a href={`/api/maintenance/report?${query}`}><FileSpreadsheet size={16} aria-hidden="true" />Descargar Excel</a></Button>
        <Button asChild variant="outline"><Link href={`/mantenimiento/informe/imprimir?${query}`} target="_blank"><Printer size={16} aria-hidden="true" />Imprimir o guardar PDF</Link></Button>
      </div>
    </CardContent></Card>
    <h2 className="mt-8 text-xl font-semibold capitalize">{monthLabel(month)}</h2>
    <ReportView report={report} detail />
  </main>;
}
