import Link from "next/link";
import { UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CreatePanel, FactGrid, ItemHeader, subtleSummary } from "@/components/ui/accent";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { maskDocument } from "@/lib/concierge/identity";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";
import { MaintenanceWorkerForm, MaintenanceWorkerStatusForm } from "./worker-forms";
import { MaintenanceWorkerManagementForms } from "./worker-management-forms";

type Worker = { record_id: string; staff_id: string; username: string; first_name: string; first_surname: string; document_number: string; birth_date: string; phone_e164: string; email: string; address: string | null; vehicles: unknown; staff_status: string };

function ageFor(birthDate: string) { const today = dateInputValue(new Date(), COLOMBIA_TIME_ZONE); return Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (today.slice(5) < birthDate.slice(5) ? 1 : 0); }

// Trabajadores de mantenimiento (entrega 2): solo el admin de mantenimiento. Mismo diseño que portería.
export default async function MaintenanceWorkersPage() {
  const { supabase } = await requireMaintenanceStaff("admin");
  const { data, error } = await supabase.rpc("maintenance_list_workers");
  if (error) throw new Error("No se pudieron cargar los trabajadores.");
  const workers = (data ?? []) as Worker[];
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-7 sm:px-10">
    <Link href="/mantenimiento" className="text-sm text-muted-foreground hover:text-foreground">← Volver a mantenimiento</Link>
    <header className="mt-5 border-b pb-5"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Mantenimiento</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Trabajadores</h1><p className="mt-2 text-sm text-muted-foreground">Cada trabajador tiene un usuario permanente y entra solo al módulo de mantenimiento.</p></header>
    <CreatePanel title="Nuevo trabajador" description="Con usuario y contraseña para entrar al módulo."><MaintenanceWorkerForm /></CreatePanel>
    <div className="mt-4 grid gap-4">
      {workers.map((worker) => { const suspended = worker.staff_status === "suspended"; return <Card key={worker.record_id}><CardContent>
        <ItemHeader icon={UserRound} title={`${worker.first_name} ${worker.first_surname}`} subtitle={`Usuario: ${worker.username}`} badge={<span className={`rounded-full px-3 py-1 text-xs font-medium ${suspended ? "bg-amber-200 text-amber-950" : "bg-primary/12 text-primary"}`}>{suspended ? "Suspendido" : "Activo"}</span>} />
        <FactGrid facts={[{ label: "Cédula", value: maskDocument(worker.document_number) }, { label: "Edad", value: ageFor(worker.birth_date) }, { label: "Teléfono", value: worker.phone_e164 }]} columns="grid-cols-2 sm:grid-cols-3" className="mt-4" />
        <details className="mt-4 border-t pt-4"><summary className={subtleSummary}>Ver detalles</summary><div className="mt-3 space-y-1 text-sm"><p>Cédula: {worker.document_number}</p><p>Fecha de nacimiento: {worker.birth_date}</p><p className="break-all">Correo: {worker.email}</p><p>Dirección: {worker.address || "Sin información"}</p><p>Vehículos: {Array.isArray(worker.vehicles) ? worker.vehicles.length : 0}</p>{Array.isArray(worker.vehicles) && worker.vehicles.map((vehicle, index) => <p key={index}>{index + 1}. {String(vehicle.type ?? "")} · {String(vehicle.brand ?? "")} · {String(vehicle.model ?? "")} · {String(vehicle.plate ?? "")}</p>)}</div></details>
        <MaintenanceWorkerStatusForm key={worker.staff_status} recordId={worker.record_id} suspended={suspended} />
        <MaintenanceWorkerManagementForms account={{ id: worker.record_id, first_name: worker.first_name, first_surname: worker.first_surname, document_number: worker.document_number, birth_date: worker.birth_date, phone_e164: worker.phone_e164, address: worker.address, vehicles: worker.vehicles, username: worker.username, email: worker.email }} />
      </CardContent></Card>; })}
      {!workers.length && <Card><CardContent><p className="text-sm text-muted-foreground">Todavía no hay trabajadores registrados.</p></CardContent></Card>}
    </div>
  </main>;
}
