import Link from "next/link";
import { FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadReport, readReportFilters, today } from "@/lib/maintenance/report";
import { ReportFilters } from "./report-filters";
import { ReportView } from "./report-view";

// Informe de mantenimiento: solo el admin. Las fechas se eligen en el calendario (desde–hasta: un día,
// una semana, un mes…) y se puede filtrar por trabajador. Se calcula en vivo, así que siempre está al
// día. Se descarga en Excel o se abre la vista para imprimir / guardar como PDF.
export default async function MaintenanceReportPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; trabajador?: string }> }) {
  const filters = readReportFilters(await searchParams);
  const report = await loadReport(filters);
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-7 sm:px-10">
    <Link href="/mantenimiento" className="text-sm text-muted-foreground hover:text-foreground">← Volver a mantenimiento</Link>
    <header className="mt-5 border-b pb-5"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Mantenimiento</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Informe</h1><p className="mt-2 text-sm text-muted-foreground">Asistencia, tareas y llamados de atención entre las fechas que elijas, en hora de Colombia.</p></header>
    <Card className="mt-6"><CardContent>
      <ReportFilters key={filters.query} from={filters.from} to={filters.to} today={today()} workerId={filters.workerId} workers={report.allWorkers} />
      <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
        <Button asChild><a href={`/api/maintenance/report?${filters.query}`}><FileSpreadsheet size={16} aria-hidden="true" />Descargar Excel</a></Button>
        <Button asChild variant="outline"><Link href={`/mantenimiento/informe/imprimir?${filters.query}`} target="_blank"><Printer size={16} aria-hidden="true" />Imprimir o guardar PDF</Link></Button>
      </div>
    </CardContent></Card>
    <h2 className="mt-8 text-xl font-semibold first-letter:uppercase">{filters.label}</h2>
    <ReportView report={report} detail />
  </main>;
}
