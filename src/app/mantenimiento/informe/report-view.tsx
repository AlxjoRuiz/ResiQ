import { deliveredLate, hoursLabel, loadReport, shiftMinutes, taskStatusLabel } from "@/lib/maintenance/report";
import { COLOMBIA_TIME_ZONE } from "@/lib/time-zone";

type Report = Awaited<ReturnType<typeof loadReport>>;

const dateTime = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: COLOMBIA_TIME_ZONE });
const time = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: COLOMBIA_TIME_ZONE });
const dateOnly = (day: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
const table = "w-full border-collapse text-sm [&_td]:border-b [&_td]:px-2 [&_td]:py-2 [&_th]:border-b [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-8 break-inside-avoid-page"><h2 className="font-semibold">{title}</h2><div className="mt-3 overflow-x-auto print:overflow-visible">{children}</div></section>;
}

// Contenido del informe; lo usan la página y la vista para imprimir (PDF), así ambas coinciden.
export function ReportView({ report, detail }: { report: Report; detail: boolean }) {
  return <>
    <Section title="Resumen por trabajador">
      {report.summaries.length ? <table className={table}><thead><tr><th>Trabajador</th><th className="text-right">Días</th><th className="text-right">Horas</th><th className="text-right">Sin salida</th><th className="text-right">Salidas a mano</th><th className="text-right">Tareas</th><th className="text-right">Aprobadas</th><th className="text-right">Vencidas</th><th className="text-right">Fuera de plazo</th><th className="text-right">Llamados</th></tr></thead>
        <tbody>{report.summaries.map((s) => <tr key={s.staff_id}><td className="font-medium">{s.name}{s.status === "revoked" && <span className="ml-1 text-xs text-muted-foreground">(dado de baja)</span>}</td><td className="text-right tabular-nums">{s.days}</td><td className="text-right whitespace-nowrap tabular-nums">{hoursLabel(s.minutes)}</td><td className="text-right tabular-nums">{s.openShifts}</td><td className="text-right tabular-nums">{s.manualExits}</td><td className="text-right tabular-nums">{s.tasks}</td><td className="text-right tabular-nums">{s.approved}</td><td className="text-right tabular-nums">{s.overdue}</td><td className="text-right tabular-nums">{s.late}</td><td className="text-right tabular-nums">{s.warnings}</td></tr>)}</tbody>
      </table> : <p className="text-sm text-muted-foreground">No hay trabajadores para este filtro.</p>}
      <p className="mt-2 text-xs text-muted-foreground">Las horas solo suman jornadas con salida. Las tareas del periodo son las que tienen la fecha límite entre esas fechas.</p>
    </Section>
    {detail && <>
      <Section title="Asistencia">
        {report.attendance.length ? <table className={table}><thead><tr><th>Trabajador</th><th>Llegada</th><th>Salida</th><th className="text-right">Horas</th><th>Observación</th></tr></thead>
          <tbody>{report.attendance.map((a, index) => <tr key={index}><td>{report.nameOf(a.staff_id)}</td><td className="whitespace-nowrap">{dateTime.format(new Date(a.check_in_at))}</td><td className="whitespace-nowrap">{a.check_out_at ? time.format(new Date(a.check_out_at)) : "Sin salida"}</td><td className="text-right whitespace-nowrap tabular-nums">{a.check_out_at ? hoursLabel(shiftMinutes(a)) : "—"}</td><td>{a.check_out_manual ? `Salida a mano: ${a.check_out_reason ?? ""}` : ""}</td></tr>)}</tbody>
        </table> : <p className="text-sm text-muted-foreground">Sin jornadas registradas en estas fechas.</p>}
      </Section>
      <Section title="Tareas">
        {report.tasks.length ? <table className={table}><thead><tr><th>Trabajador</th><th>Tarea</th><th>Conjunto</th><th>Fecha límite</th><th>Estado</th><th>Entrega</th></tr></thead>
          <tbody>{report.tasks.map((t) => <tr key={t.id}><td>{report.nameOf(t.staff_id)}</td><td>{t.title}</td><td>{t.property_name}</td><td className="whitespace-nowrap">{dateOnly(t.due_date)}</td><td className="whitespace-nowrap">{t.overdue ? `${taskStatusLabel[t.status]} · vencida` : taskStatusLabel[t.status]}</td><td className="whitespace-nowrap">{t.first_submitted_at ? `${dateTime.format(new Date(t.first_submitted_at))}${deliveredLate(t) ? " (fuera de plazo)" : ""}` : "—"}</td></tr>)}</tbody>
        </table> : <p className="text-sm text-muted-foreground">Sin tareas con fecha límite en estas fechas.</p>}
      </Section>
      <Section title="Llamados de atención">
        {report.warnings.length ? <table className={table}><thead><tr><th>Trabajador</th><th>Fecha</th><th>Motivo</th><th>Descripción</th></tr></thead>
          <tbody>{report.warnings.map((w, index) => <tr key={index}><td>{report.nameOf(w.staff_id)}</td><td className="whitespace-nowrap">{dateOnly(w.warning_date)}</td><td>{w.reason}</td><td className="whitespace-pre-line">{w.description}</td></tr>)}</tbody>
        </table> : <p className="text-sm text-muted-foreground">Sin llamados de atención en estas fechas.</p>}
      </Section>
    </>}
  </>;
}
