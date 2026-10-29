import "server-only";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";

// Informe mensual de mantenimiento (entrega 6): lo comparten la página, la vista para imprimir y el
// Excel, para que los tres muestren exactamente las mismas cifras.
export type ReportAttendance = { staff_id: string; check_in_at: string; check_out_at: string | null; check_out_manual: boolean; check_out_reason: string | null };
export type ReportTask = { id: string; staff_id: string; title: string; property_name: string; due_date: string; status: "pending" | "submitted" | "approved" | "rejected"; overdue: boolean; first_submitted_at: string | null; deliveries: number; approved_at: string | null };
export type ReportWarning = { staff_id: string; warning_date: string; reason: string; description: string };
export type ReportWorker = { staff_id: string; name: string; username: string | null; status: string };
export type WorkerSummary = ReportWorker & { days: number; minutes: number; openShifts: number; manualExits: number; tasks: number; approved: number; submitted: number; pending: number; rejected: number; overdue: number; late: number; warnings: number };

export const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const uuidPattern = /^[0-9a-f-]{36}$/i;
export const taskStatusLabel = { pending: "Pendiente", submitted: "Por revisar", approved: "Aprobada", rejected: "Rechazada" } as const;

export function currentMonth() { return dateInputValue(new Date(), COLOMBIA_TIME_ZONE).slice(0, 7); }
export function monthLabel(month: string) { return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`)); }
export function hoursLabel(minutes: number) { return `${Math.floor(minutes / 60)} h ${minutes % 60} min`; }
export function shiftMinutes(item: ReportAttendance) { return item.check_out_at ? Math.round((Date.parse(item.check_out_at) - Date.parse(item.check_in_at)) / 60000) : 0; }
// Entregada fuera de plazo: la primera entrega llegó después de la fecha límite (hora de Bogotá).
export function deliveredLate(task: ReportTask) { return !!task.first_submitted_at && dateInputValue(new Date(task.first_submitted_at), COLOMBIA_TIME_ZONE) > task.due_date; }

export function readReportFilters(params: { mes?: string | null; trabajador?: string | null }) {
  const month = params.mes && monthPattern.test(params.mes) && params.mes <= currentMonth() ? params.mes : currentMonth();
  const workerId = params.trabajador && uuidPattern.test(params.trabajador) ? params.trabajador : null;
  return { month, workerId };
}

// Solo el admin de mantenimiento (la función de la base también lo valida).
export async function loadMonthlyReport(month: string, workerId: string | null) {
  const { supabase } = await requireMaintenanceStaff("admin");
  // Se trae el mes completo y se filtra aquí, para que el selector siga mostrando a todos los trabajadores.
  const { data, error } = await supabase.rpc("maintenance_monthly_report", { target_month: `${month}-01` });
  if (error || !data) throw new Error("No se pudo generar el informe.");
  const full = data as { workers: ReportWorker[]; attendance: ReportAttendance[]; tasks: ReportTask[]; warnings: ReportWarning[] };
  const mine = <T extends { staff_id: string }>(items: T[]) => (workerId ? items.filter((item) => item.staff_id === workerId) : items);
  const report = { allWorkers: full.workers, workers: mine(full.workers), attendance: mine(full.attendance), tasks: mine(full.tasks), warnings: mine(full.warnings) };
  const summaries: WorkerSummary[] = report.workers.map((worker) => {
    const shifts = report.attendance.filter((item) => item.staff_id === worker.staff_id);
    const tasks = report.tasks.filter((item) => item.staff_id === worker.staff_id);
    return {
      ...worker,
      days: new Set(shifts.map((item) => dateInputValue(new Date(item.check_in_at), COLOMBIA_TIME_ZONE))).size,
      minutes: shifts.reduce((total, item) => total + shiftMinutes(item), 0),
      openShifts: shifts.filter((item) => !item.check_out_at).length,
      manualExits: shifts.filter((item) => item.check_out_manual).length,
      tasks: tasks.length,
      approved: tasks.filter((item) => item.status === "approved").length,
      submitted: tasks.filter((item) => item.status === "submitted").length,
      pending: tasks.filter((item) => item.status === "pending" && !item.overdue).length,
      rejected: tasks.filter((item) => item.status === "rejected" && !item.overdue).length,
      overdue: tasks.filter((item) => item.overdue).length,
      late: tasks.filter(deliveredLate).length,
      warnings: report.warnings.filter((item) => item.staff_id === worker.staff_id).length,
    };
  });
  const names = new Map(report.allWorkers.map((worker) => [worker.staff_id, worker.name]));
  return { ...report, summaries, nameOf: (staffId: string) => names.get(staffId) ?? "—" };
}
