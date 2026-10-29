import "server-only";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";

// Informe de mantenimiento por rango de fechas (entrega 6; desde–hasta con calendario el 28/10/2026): lo comparten la
// página, la vista para imprimir y el Excel, para que los tres muestren exactamente las mismas cifras.
// Se calcula en vivo cada vez que se abre, así que siempre está al día.
export type ReportAttendance = { staff_id: string; check_in_at: string; check_out_at: string | null; check_out_manual: boolean; check_out_reason: string | null };
export type ReportTask = { id: string; staff_id: string; title: string; property_name: string; due_date: string; status: "pending" | "submitted" | "approved" | "rejected"; overdue: boolean; first_submitted_at: string | null; deliveries: number; approved_at: string | null };
export type ReportWarning = { staff_id: string; warning_date: string; reason: string; description: string };
export type ReportWorker = { staff_id: string; name: string; username: string | null; status: string };
export type WorkerSummary = ReportWorker & { days: number; minutes: number; openShifts: number; manualExits: number; tasks: number; approved: number; submitted: number; pending: number; rejected: number; overdue: number; late: number; warnings: number };

const dayPattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const uuidPattern = /^[0-9a-f-]{36}$/i;
export const taskStatusLabel = { pending: "Pendiente", submitted: "Por revisar", approved: "Aprobada", rejected: "Rechazada" } as const;

export function hoursLabel(minutes: number) { return `${Math.floor(minutes / 60)} h ${minutes % 60} min`; }
export function shiftMinutes(item: ReportAttendance) { return item.check_out_at ? Math.round((Date.parse(item.check_out_at) - Date.parse(item.check_in_at)) / 60000) : 0; }
// Entregada fuera de plazo: la primera entrega llegó después de la fecha límite (hora de Bogotá).
export function deliveredLate(task: ReportTask) { return !!task.first_submitted_at && dateInputValue(new Date(task.first_submitted_at), COLOMBIA_TIME_ZONE) > task.due_date; }

export function today() { return dateInputValue(new Date(), COLOMBIA_TIME_ZONE); }
const shortDate = (day: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
export function dayLabel(day: string) { return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)); }
const validDay = (value?: string | null) => !!value && dayPattern.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

export type ReportFilters = { from: string; to: string; workerId: string | null; label: string; fileName: string; query: string };

// Rango «desde»–«hasta» (YYYY-MM-DD, ambos incluidos) elegido en el calendario. Por defecto: del 1 del
// mes actual a hoy. Nunca fechas futuras ni más de un año; si el rango viene al revés, se ordena.
export function readReportFilters(params: { desde?: string | null; hasta?: string | null; trabajador?: string | null }): ReportFilters {
  const now = today();
  let from = validDay(params.desde) && params.desde! <= now ? params.desde! : `${now.slice(0, 7)}-01`;
  let to = validDay(params.hasta) && params.hasta! <= now ? params.hasta! : now;
  if (from > to) [from, to] = [to, from];
  if (daysBetween(from, to) > 365) from = new Date(Date.parse(`${to}T12:00:00Z`) - 365 * 86400000).toISOString().slice(0, 10);
  const workerId = params.trabajador && uuidPattern.test(params.trabajador) ? params.trabajador : null;
  const query = new URLSearchParams({ desde: from, hasta: to, ...(workerId ? { trabajador: workerId } : {}) }).toString();
  return { from, to, workerId, query, label: from === to ? dayLabel(from) : `${shortDate(from)} – ${shortDate(to)}`, fileName: `informe-mantenimiento-${from === to ? from : `${from}_a_${to}`}.xlsx` };
}

// Solo el admin de mantenimiento (la función de la base también lo valida).
export async function loadReport({ from, to, workerId }: Pick<ReportFilters, "from" | "to" | "workerId">) {
  const { supabase } = await requireMaintenanceStaff("admin");
  // Se trae el periodo completo y se filtra aquí, para que el selector siga mostrando a todos los trabajadores.
  const { data, error } = await supabase.rpc("maintenance_report", { target_from: from, target_to: to });
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
