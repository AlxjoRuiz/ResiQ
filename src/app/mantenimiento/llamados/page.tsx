import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";
import { NewWarningForm } from "./warning-form";

type Warning = { warning_id: string; staff_id: string; worker_name: string; warning_date: string; reason: string; description: string; created_at: string };

const uuidPattern = /^[0-9a-f-]{36}$/i;
const dateOnly = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" });

// Llamados de atención (entrega 5). Admin: registra y consulta, filtrando por trabajador.
// Trabajador: solo consulta los suyos.
export default async function MaintenanceWarningsPage({ searchParams }: { searchParams: Promise<{ trabajador?: string }> }) {
  const { supabase, staff } = await requireMaintenanceStaff();
  const admin = staff.role === "admin";
  const params = await searchParams;
  const workerId = admin && params.trabajador && uuidPattern.test(params.trabajador) ? params.trabajador : null;
  const [warningsResult, workersResult] = await Promise.all([
    supabase.rpc("maintenance_list_warnings", { target_staff_id: workerId }),
    admin ? supabase.rpc("maintenance_list_workers") : Promise.resolve({ data: [], error: null }),
  ]);
  if (warningsResult.error || workersResult.error) throw new Error("No se pudieron cargar los llamados de atención.");
  const warnings = (warningsResult.data ?? []) as Warning[];
  const workers = ((workersResult.data ?? []) as { staff_id: string; first_name: string; first_surname: string; staff_status: string }[])
    .filter((worker) => worker.staff_status !== "revoked").map((worker) => ({ staffId: worker.staff_id, name: `${worker.first_name} ${worker.first_surname}` }));
  const today = dateInputValue(new Date(), COLOMBIA_TIME_ZONE);

  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-7 sm:px-10">
    <Link href="/mantenimiento" className="text-sm text-muted-foreground hover:text-foreground">← Volver a mantenimiento</Link>
    <header className="mt-5 border-b pb-5"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Mantenimiento</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{admin ? "Llamados de atención" : "Mis llamados de atención"}</h1><p className="mt-2 text-sm text-muted-foreground">{admin ? "Registra y consulta los llamados de atención de cada trabajador." : "Aquí puedes consultar los llamados de atención que te han registrado."}</p></header>
    {admin && <>
      <Card className="mt-6"><CardContent><details><summary className="cursor-pointer font-semibold">Nuevo llamado de atención</summary><div className="mt-5"><NewWarningForm workers={workers} today={today} /></div></details></CardContent></Card>
      <form className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Trabajador<select name="trabajador" defaultValue={workerId ?? ""} className="mt-1 block h-11 rounded-lg border bg-white px-3 text-sm"><option value="">Todos</option>{workers.map((worker) => <option key={worker.staffId} value={worker.staffId}>{worker.name}</option>)}</select></label>
        <button className="h-11 rounded-lg border bg-white px-4 text-sm font-medium hover:bg-secondary">Ver</button>
      </form>
    </>}
    <div className="mt-6 grid gap-4">
      {warnings.map((warning) => <Card key={warning.warning_id}><CardContent>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold">{warning.reason}</h2>{admin && <p className="text-sm text-muted-foreground">{warning.worker_name}</p>}</div><span className="rounded-full bg-secondary px-3 py-1 text-xs">{dateOnly.format(new Date(`${warning.warning_date}T12:00:00Z`))}</span></div>
        <p className="mt-3 text-sm whitespace-pre-line">{warning.description}</p>
      </CardContent></Card>)}
      {!warnings.length && <Card><CardContent><p className="text-sm text-muted-foreground">{admin ? "No hay llamados de atención registrados." : "No tienes llamados de atención."}</p></CardContent></Card>}
    </div>
  </main>;
}
