import { deliveredLate, hoursLabel, loadReport, readReportFilters, shiftMinutes, taskStatusLabel } from "@/lib/maintenance/report";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";
import { writeWorkbook } from "@/lib/xlsx/write-workbook";

const time = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: COLOMBIA_TIME_ZONE });
const localDate = (iso: string) => dateInputValue(new Date(iso), COLOMBIA_TIME_ZONE);

// Informe de mantenimiento en Excel para el rango desde–hasta: hojas Resumen, Asistencia, Tareas y
// Llamados. Solo el admin de mantenimiento (loadReport lo valida; si no, responde 404).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = readReportFilters({ desde: url.searchParams.get("desde"), hasta: url.searchParams.get("hasta"), trabajador: url.searchParams.get("trabajador") });
  // Sin try/catch: así la redirección al login y el 404 de quien no es admin funcionan normalmente.
  const report = await loadReport(filters);

  const archive = writeWorkbook([
    { name: "Resumen", rows: [
      ["Trabajador", "Usuario", "Días trabajados", "Horas trabajadas", "Horas (decimal)", "Jornadas sin salida", "Salidas a mano", "Tareas del periodo", "Aprobadas", "Por revisar", "Pendientes", "Rechazadas", "Vencidas", "Entregadas fuera de plazo", "Llamados de atención"],
      ...report.summaries.map((s) => [s.name, s.username ?? "", s.days, hoursLabel(s.minutes), Math.round(s.minutes / 6) / 10, s.openShifts, s.manualExits, s.tasks, s.approved, s.submitted, s.pending, s.rejected, s.overdue, s.late, s.warnings]),
    ] },
    { name: "Asistencia", rows: [
      ["Trabajador", "Fecha", "Llegada", "Salida", "Horas trabajadas", "Salida a mano", "Motivo"],
      ...report.attendance.map((a) => [report.nameOf(a.staff_id), localDate(a.check_in_at), time.format(new Date(a.check_in_at)), a.check_out_at ? time.format(new Date(a.check_out_at)) : "Sin salida", a.check_out_at ? hoursLabel(shiftMinutes(a)) : "", a.check_out_manual ? "Sí" : "No", a.check_out_reason ?? ""]),
    ] },
    { name: "Tareas", rows: [
      ["Trabajador", "Tarea", "Conjunto", "Fecha límite", "Estado", "Vencida", "Entregas", "Primera entrega", "Fuera de plazo", "Aprobada el"],
      ...report.tasks.map((t) => [report.nameOf(t.staff_id), t.title, t.property_name, t.due_date, taskStatusLabel[t.status], t.overdue ? "Sí" : "No", t.deliveries, t.first_submitted_at ? localDate(t.first_submitted_at) : "", deliveredLate(t) ? "Sí" : "No", t.approved_at ? localDate(t.approved_at) : ""]),
    ] },
    { name: "Llamados", rows: [
      ["Trabajador", "Fecha", "Motivo", "Descripción"],
      ...report.warnings.map((w) => [report.nameOf(w.staff_id), w.warning_date, w.reason, w.description]),
    ] },
  ]);
  return new Response(Buffer.from(archive), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename=${filters.fileName}`, "cache-control": "no-store" } });
}
