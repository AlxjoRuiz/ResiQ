import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, COLOMBIA_TIME_ZONE, dateInputValue, dateTimeInputValue, zonedDayStart } from "@/lib/time-zone";
import { CheckInOutForm, CloseAttendanceForm } from "./attendance-forms";

type Attendance = { attendance_id: string; staff_id: string; worker_name: string; check_in_at: string; check_in_photo_path: string; check_out_at: string | null; check_out_photo_path: string | null; check_out_manual: boolean; check_out_reason: string | null };

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern = /^[0-9a-f-]{36}$/i;
const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: COLOMBIA_TIME_ZONE });
const dayFormat = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: COLOMBIA_TIME_ZONE });

// Horas trabajadas de una jornada cerrada, en formato «7 h 35 min».
function workedTime(item: Attendance) {
  if (!item.check_out_at) return null;
  const minutes = Math.round((Date.parse(item.check_out_at) - Date.parse(item.check_in_at)) / 60000);
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

// Enlaces firmados (10 min) para ver las fotos privadas; solo se piden las de la lista que se muestra.
async function photoLinks(items: Attendance[]) {
  const paths = items.flatMap((item) => [item.check_in_photo_path, item.check_out_photo_path]).filter((path): path is string => !!path);
  if (!paths.length) return new Map<string, string>();
  const { data } = await createAdminClient().storage.from("private-documents").createSignedUrls(paths, 600);
  return new Map((data ?? []).filter((link) => link.path && link.signedUrl).map((link) => [link.path as string, link.signedUrl as string]));
}

// Miniatura de la foto; al tocarla se abre completa.
function Photo({ url, alt }: { url: string; alt: string }) {
  return <a href={url} target="_blank" rel="noreferrer">
    {/* eslint-disable-next-line @next/next/no-img-element -- foto privada con enlace firmado, no pasa por el optimizador */}
    <img src={url} alt={alt} loading="lazy" className="mt-2 aspect-square w-full max-w-40 rounded-xl border object-cover" />
  </a>;
}

function AttendanceRow({ item, photos, showName, admin }: { item: Attendance; photos: Map<string, string>; showName: boolean; admin: boolean }) {
  const inPhoto = photos.get(item.check_in_photo_path), outPhoto = item.check_out_photo_path ? photos.get(item.check_out_photo_path) : undefined;
  const worked = workedTime(item);
  return <Card><CardContent>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">{showName && <h2 className="font-semibold">{item.worker_name}</h2>}<p className="text-sm capitalize text-muted-foreground">{dayFormat.format(new Date(item.check_in_at))}</p></div>
      {item.check_out_at ? <span className="rounded-full bg-secondary px-3 py-1 text-xs">{worked}</span> : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">Sin salida</span>}
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <figure className="min-w-0"><figcaption className="text-sm"><span className="text-muted-foreground">Llegada:</span> <strong>{timeFormat.format(new Date(item.check_in_at))}</strong></figcaption>{inPhoto && <Photo url={inPhoto} alt={`Foto de llegada de ${item.worker_name}`} />}</figure>
      <figure className="min-w-0"><figcaption className="text-sm"><span className="text-muted-foreground">Salida:</span> <strong>{item.check_out_at ? timeFormat.format(new Date(item.check_out_at)) : "—"}</strong></figcaption>{outPhoto && <Photo url={outPhoto} alt={`Foto de salida de ${item.worker_name}`} />}{item.check_out_manual && <p className="mt-2 text-xs text-amber-900"><span className="rounded-full bg-amber-100 px-2 py-0.5">Salida registrada a mano</span><span className="mt-1 block text-muted-foreground">Motivo: {item.check_out_reason}</span></p>}</figure>
    </div>
    {admin && !item.check_out_at && <CloseAttendanceForm attendanceId={item.attendance_id} defaultTime={dateTimeInputValue(new Date(), COLOMBIA_TIME_ZONE)} />}
  </CardContent></Card>;
}

// Asistencia (entrega 3). Trabajador: marca llegada/salida con foto y ve sus últimas jornadas.
// Admin de mantenimiento: llegadas y salidas por día y trabajador, jornadas sin salida y registro manual.
export default async function MaintenanceAttendancePage({ searchParams }: { searchParams: Promise<{ dia?: string; trabajador?: string }> }) {
  const { supabase, staff } = await requireMaintenanceStaff();
  const today = dateInputValue(new Date(), COLOMBIA_TIME_ZONE);
  const back = <Link href="/mantenimiento" className="text-sm text-muted-foreground hover:text-foreground">← Volver a mantenimiento</Link>;

  if (staff.role === "worker") {
    // Últimos 14 días; la jornada abierta (si la hay) decide si el botón es de llegada o de salida.
    const { data, error } = await supabase.rpc("maintenance_list_attendance", { target_from: zonedDayStart(addDays(today, -13), COLOMBIA_TIME_ZONE).toISOString(), target_to: zonedDayStart(addDays(today, 1), COLOMBIA_TIME_ZONE).toISOString() });
    if (error) throw new Error("No se pudo cargar tu asistencia.");
    const items = (data ?? []) as Attendance[];
    const open = items.find((item) => !item.check_out_at);
    const photos = await photoLinks(items);
    return <main className="mx-auto min-h-screen max-w-2xl px-5 py-7 sm:px-10">
      {back}
      <header className="mt-5 border-b pb-5"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Mantenimiento</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Mi asistencia</h1><p className="mt-2 text-sm text-muted-foreground">Toma una foto para marcar. La hora la registra el sistema (hora de Colombia).</p></header>
      <Card className="mt-6"><CardContent>
        <p className="mb-4 text-sm">{open ? <>Llegaste a las <strong>{timeFormat.format(new Date(open.check_in_at))}</strong>. Cuando termines, marca tu salida.</> : "No tienes una jornada abierta. Marca tu llegada al empezar."}</p>
        <CheckInOutForm key={open?.attendance_id ?? "in"} kind={open ? "out" : "in"} />
      </CardContent></Card>
      <h2 className="mt-8 font-semibold">Últimos 14 días</h2>
      <div className="mt-3 grid gap-3">
        {items.map((item) => <AttendanceRow key={item.attendance_id} item={item} photos={photos} showName={false} admin={false} />)}
        {!items.length && <Card><CardContent><p className="text-sm text-muted-foreground">Todavía no tienes jornadas registradas.</p></CardContent></Card>}
      </div>
    </main>;
  }

  const params = await searchParams;
  const day = params.dia && dayPattern.test(params.dia) && params.dia <= today ? params.dia : today;
  const workerId = params.trabajador && uuidPattern.test(params.trabajador) ? params.trabajador : null;
  // Jornadas del día elegido y, aparte, las que siguen sin salida de los últimos 30 días.
  const [dayResult, openResult, workersResult] = await Promise.all([
    supabase.rpc("maintenance_list_attendance", { target_from: zonedDayStart(day, COLOMBIA_TIME_ZONE).toISOString(), target_to: zonedDayStart(addDays(day, 1), COLOMBIA_TIME_ZONE).toISOString(), target_staff_id: workerId }),
    supabase.rpc("maintenance_list_attendance", { target_from: zonedDayStart(addDays(today, -30), COLOMBIA_TIME_ZONE).toISOString(), target_to: zonedDayStart(day, COLOMBIA_TIME_ZONE).toISOString(), target_staff_id: workerId }),
    supabase.rpc("maintenance_list_workers"),
  ]);
  if (dayResult.error || openResult.error || workersResult.error) throw new Error("No se pudo cargar la asistencia.");
  const items = (dayResult.data ?? []) as Attendance[];
  const pending = ((openResult.data ?? []) as Attendance[]).filter((item) => !item.check_out_at);
  const workers = (workersResult.data ?? []) as { staff_id: string; first_name: string; first_surname: string }[];
  const photos = await photoLinks([...pending, ...items]);
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-7 sm:px-10">
    {back}
    <header className="mt-5 border-b pb-5"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Mantenimiento</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Asistencia</h1><p className="mt-2 text-sm text-muted-foreground">Llegadas y salidas de cada trabajador con su foto, en hora de Colombia.</p></header>
    <form className="mt-6 flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium">Día<input name="dia" type="date" defaultValue={day} max={today} className="mt-1 block h-11 rounded-lg border bg-white px-3 text-sm" /></label>
      <label className="text-sm font-medium">Trabajador<select name="trabajador" defaultValue={workerId ?? ""} className="mt-1 block h-11 rounded-lg border bg-white px-3 text-sm"><option value="">Todos</option>{workers.map((worker) => <option key={worker.staff_id} value={worker.staff_id}>{worker.first_name} {worker.first_surname}</option>)}</select></label>
      <button className="h-11 rounded-lg border bg-white px-4 text-sm font-medium hover:bg-secondary">Ver</button>
    </form>
    {pending.length > 0 && <section className="mt-6"><h2 className="font-semibold">Sin salida de días anteriores</h2><p className="mt-1 text-sm text-muted-foreground">No suman horas hasta que se registre la salida.</p><div className="mt-3 grid gap-3">{pending.map((item) => <AttendanceRow key={item.attendance_id} item={item} photos={photos} showName admin />)}</div></section>}
    <section className="mt-6"><h2 className="font-semibold capitalize">{dayFormat.format(zonedDayStart(day, COLOMBIA_TIME_ZONE))}</h2><div className="mt-3 grid gap-3">
      {items.map((item) => <AttendanceRow key={item.attendance_id} item={item} photos={photos} showName admin />)}
      {!items.length && <Card><CardContent><p className="text-sm text-muted-foreground">No hay llegadas registradas este día.</p></CardContent></Card>}
    </div></section>
  </main>;
}
