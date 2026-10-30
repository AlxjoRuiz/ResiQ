import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Hourglass, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { signedPhotoLinks } from "@/lib/maintenance/photos";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";
import { DeleteTaskForm, DeliverTaskForm, NewTaskForm, ReviewTaskForm } from "./task-forms";

type Delivery = { id: string; note: string | null; photo_paths: string[]; submitted_at: string; review: "approved" | "rejected" | null; review_comment: string | null; reviewed_at: string | null };
type Task = { task_id: string; staff_id: string; worker_name: string; title: string; description: string; property_name: string; due_date: string; status: "pending" | "submitted" | "approved" | "rejected"; overdue: boolean; created_at: string; deliveries: Delivery[] };

const uuidPattern = /^[0-9a-f-]{36}$/i;
const statusFilters = [
  { value: "", label: "Todas" }, { value: "submitted", label: "Por revisar" }, { value: "pending", label: "Pendientes" },
  { value: "overdue", label: "Vencidas" }, { value: "rejected", label: "Rechazadas" }, { value: "approved", label: "Aprobadas" },
];
const dateTime = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: COLOMBIA_TIME_ZONE });
const dateOnly = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" });

// Estado con ícono y texto (nunca solo color). «Vencida» se calcula en la base.
function StatusBadge({ task }: { task: Task }) {
  const badge = task.overdue ? { label: task.status === "rejected" ? "Rechazada · vencida" : "Vencida", icon: AlertTriangle, className: "bg-red-100 text-red-900" }
    : { pending: { label: "Pendiente", icon: Clock3, className: "bg-secondary" }, submitted: { label: "Por revisar", icon: Hourglass, className: "bg-amber-100 text-amber-900" },
      approved: { label: "Aprobada", icon: CheckCircle2, className: "bg-green-100 text-green-900" }, rejected: { label: "Rechazada", icon: XCircle, className: "bg-red-100 text-red-900" } }[task.status];
  const Icon = badge.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}><Icon size={14} aria-hidden="true" />{badge.label}</span>;
}

function DeliveryView({ delivery, dueDate, photos }: { delivery: Delivery; dueDate: string; photos: Map<string, string> }) {
  const late = dateInputValue(new Date(delivery.submitted_at), COLOMBIA_TIME_ZONE) > dueDate;
  return <div className="grid gap-2">
    <p className="text-sm"><span className="text-muted-foreground">Entregada:</span> {dateTime.format(new Date(delivery.submitted_at))}{late && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Fuera de plazo</span>}</p>
    {/* Miniaturas de tamaño fijo (80 px en celular, 96 px en computador); al tocarlas se abre la foto completa. */}
    <div className="flex flex-wrap gap-2">{delivery.photo_paths.map((path, index) => { const url = photos.get(path); return url ? <a key={path} href={url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element -- foto privada con enlace firmado, no pasa por el optimizador */}
      <img src={url} alt={`Foto ${index + 1} de la entrega`} loading="lazy" className="size-20 rounded-xl border object-cover sm:size-24" />
    </a> : null; })}</div>
    {delivery.note && <p className="text-sm whitespace-pre-line"><span className="text-muted-foreground">Nota:</span> {delivery.note}</p>}
    {delivery.review && <p className={`rounded-lg px-3 py-2 text-sm ${delivery.review === "approved" ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}><strong>{delivery.review === "approved" ? "Aprobada" : "Rechazada"}</strong>{delivery.review_comment && <>: {delivery.review_comment}</>}</p>}
  </div>;
}

function TaskCard({ task, photos, admin }: { task: Task; photos: Map<string, string>; admin: boolean }) {
  const [latest, ...previous] = task.deliveries;
  return <Card><CardContent>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="font-semibold">{task.title}</h2><p className="text-sm text-muted-foreground">{task.property_name}{admin && <> · {task.worker_name}</>}</p></div>
      <StatusBadge task={task} />
    </div>
    <p className="mt-3 text-sm whitespace-pre-line">{task.description}</p>
    <p className="mt-2 text-sm"><span className="text-muted-foreground">Fecha límite:</span> <strong>{dateOnly.format(new Date(`${task.due_date}T12:00:00Z`))}</strong></p>
    {latest && <div className="mt-4 border-t pt-4"><DeliveryView delivery={latest} dueDate={task.due_date} photos={photos} /></div>}
    {previous.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">Entregas anteriores ({previous.length})</summary><div className="mt-3 grid gap-4">{previous.map((delivery) => <DeliveryView key={delivery.id} delivery={delivery} dueDate={task.due_date} photos={photos} />)}</div></details>}
    {admin && task.status === "submitted" && <ReviewTaskForm taskId={task.task_id} />}
    {admin && task.status === "pending" && !task.deliveries.length && <DeleteTaskForm taskId={task.task_id} />}
    {!admin && (task.status === "pending" || task.status === "rejected") && <DeliverTaskForm taskId={task.task_id} again={task.status === "rejected"} />}
  </CardContent></Card>;
}

// Tareas (entrega 4). Admin: crea tareas, filtra por estado y trabajador, aprueba o rechaza entregas.
// Trabajador: ve sus tareas y las entrega con fotos; si se la rechazan, puede volver a entregarla.
export default async function MaintenanceTasksPage({ searchParams }: { searchParams: Promise<{ estado?: string; trabajador?: string }> }) {
  const { supabase, staff } = await requireMaintenanceStaff();
  const admin = staff.role === "admin";
  const params = await searchParams;
  const status = admin && statusFilters.some((filter) => filter.value === params.estado) ? params.estado || null : null;
  const workerId = admin && params.trabajador && uuidPattern.test(params.trabajador) ? params.trabajador : null;
  const [tasksResult, workersResult] = await Promise.all([
    supabase.rpc("maintenance_list_tasks", { target_staff_id: workerId, target_status: status }),
    admin ? supabase.rpc("maintenance_list_workers") : Promise.resolve({ data: [], error: null }),
  ]);
  if (tasksResult.error || workersResult.error) throw new Error("No se pudieron cargar las tareas.");
  const tasks = (tasksResult.data ?? []) as Task[];
  const workers = ((workersResult.data ?? []) as { staff_id: string; first_name: string; first_surname: string; staff_status: string }[]).map((worker) => ({ staffId: worker.staff_id, name: `${worker.first_name} ${worker.first_surname}`, active: worker.staff_status === "active" }));
  const photos = await signedPhotoLinks(tasks.flatMap((task) => task.deliveries.flatMap((delivery) => delivery.photo_paths)));
  const today = dateInputValue(new Date(), COLOMBIA_TIME_ZONE);

  return <main className={`mx-auto min-h-screen px-5 py-7 sm:px-10 ${admin ? "max-w-4xl" : "max-w-2xl"}`}>
    <Link href="/mantenimiento" className="text-sm text-muted-foreground hover:text-foreground">← Volver a mantenimiento</Link>
    <header className="mt-5 border-b pb-5"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Mantenimiento</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{admin ? "Tareas" : "Mis tareas"}</h1><p className="mt-2 text-sm text-muted-foreground">{admin ? "Asigna tareas y revisa las entregas con sus fotos." : "Cuando termines una tarea, entrégala con fotos del trabajo."}</p></header>
    {admin && <>
      <Card className="mt-6"><CardContent><details><summary className="cursor-pointer font-semibold">Nueva tarea</summary><div className="mt-5"><NewTaskForm workers={workers.filter((worker) => worker.active)} today={today} /></div></details></CardContent></Card>
      <form className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Estado<select name="estado" defaultValue={status ?? ""} className="mt-1 block h-11 rounded-lg border bg-white px-3 text-sm">{statusFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>
        <label className="text-sm font-medium">Trabajador<select name="trabajador" defaultValue={workerId ?? ""} className="mt-1 block h-11 rounded-lg border bg-white px-3 text-sm"><option value="">Todos</option>{workers.map((worker) => <option key={worker.staffId} value={worker.staffId}>{worker.name}</option>)}</select></label>
        <button className="h-11 rounded-lg border bg-white px-4 text-sm font-medium hover:bg-secondary">Ver</button>
      </form>
    </>}
    <div className="mt-6 grid gap-4">
      {tasks.map((task) => <TaskCard key={task.task_id} task={task} photos={photos} admin={admin} />)}
      {!tasks.length && <Card><CardContent><p className="text-sm text-muted-foreground">{admin ? "No hay tareas con este filtro." : "No tienes tareas asignadas."}</p></CardContent></Card>}
    </div>
  </main>;
}
