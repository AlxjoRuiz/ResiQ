import type { ReactNode } from "react";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";

// Gráficas del informe de mantenimiento (29/10/2026): en la vista para imprimir (PDF) y, con el mes en
// curso, en el inicio del admin de mantenimiento.
// SVG estático (sin interacción, porque se imprime): cada barra lleva su valor escrito y la dona su
// leyenda con cantidad y porcentaje; la tabla «Resumen por trabajador» trae las mismas cifras.
// Colores: azul del panel para una sola serie; estados de tareas con los colores del panel de
// mantenimiento, en un orden validado para que ningún par vecino se confunda (también con daltonismo).
type Summary = { staff_id: string; name: string; minutes: number; warnings: number; approved: number; submitted: number; pending: number; rejected: number; overdue: number };
type Shift = { staff_id: string; check_in_at: string };

const BAR = "#2a78d6";
const TASK_STATUS = [
  { key: "approved", label: "Aprobadas", color: "#0ca30c" },
  { key: "submitted", label: "Por revisar", color: "#fab219" },
  { key: "overdue", label: "Vencidas", color: "#d03b3b" },
  { key: "rejected", label: "Rechazadas", color: "#6250d6" },
  { key: "pending", label: "Pendientes", color: "#8b95a5" },
] as const;
const hoursLabel = (minutes: number) => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
const dayDate = (day: string) => new Date(`${day}T12:00:00Z`);
const shortMonths = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const shortDay = (day: string) => `${Number(day.slice(8, 10))} ${shortMonths[Number(day.slice(5, 7)) - 1]}`;
const monthName = (month: string) => new Intl.DateTimeFormat("es-CO", { month: "short", year: "2-digit", timeZone: "UTC" }).format(dayDate(`${month}-01`));

function Chart({ title, note, children, wide = false }: { title: string; note?: string; children: ReactNode; wide?: boolean }) {
  return <figure className={`break-inside-avoid rounded-xl border bg-white p-4 [print-color-adjust:exact] ${wide ? "sm:col-span-2 print:col-span-2" : ""}`}>
    <figcaption><h3 className="text-sm font-semibold">{title}</h3>{note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}</figcaption>
    <div className="mt-3">{children}</div>
  </figure>;
}

// Barras horizontales, una por trabajador (nombre arriba, barra y valor escrito al lado). En HTML para
// que el texto tenga su tamaño normal y los nombres largos se lean completos.
function HorizontalBars({ rows, label, empty }: { rows: { id: string; name: string; value: number; text: string }[]; label: string; empty: string }) {
  const max = Math.max(...rows.map((row) => row.value), 0);
  if (!rows.length || max === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <ul className="grid gap-3" aria-label={label}>{rows.map((row) => <li key={row.id} className="grid gap-1">
    <span className="text-xs text-muted-foreground">{row.name}</span>
    <span className="flex items-center gap-2"><span className="h-3.5 rounded-r-[4px]" style={{ width: `${row.value > 0 ? Math.max(2, (row.value / max) * 75) : 0}%`, background: BAR }} aria-hidden="true" /><strong className="text-sm whitespace-nowrap tabular-nums">{row.text}</strong></span>
  </li>)}</ul>;
}

// Trabajadores que marcaron llegada por día (hasta 62 días) o jornadas por mes (rangos más largos).
function attendancePoints(shifts: Shift[], from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to; day = new Date(dayDate(day).getTime() + 86400000).toISOString().slice(0, 10)) days.push(day);
  const byDay = new Map<string, Set<string>>();
  for (const shift of shifts) {
    const day = dateInputValue(new Date(shift.check_in_at), COLOMBIA_TIME_ZONE);
    byDay.set(day, (byDay.get(day) ?? new Set()).add(shift.staff_id));
  }
  if (days.length <= 62) return { monthly: false, points: days.map((day) => ({ key: day, label: shortDay(day), value: byDay.get(day)?.size ?? 0 })) };
  const months = [...new Set(days.map((day) => day.slice(0, 7)))];
  return { monthly: true, points: months.map((month) => ({ key: month, label: monthName(month), value: shifts.filter((shift) => dateInputValue(new Date(shift.check_in_at), COLOMBIA_TIME_ZONE).startsWith(month)).length })) };
}

function ColumnBars({ points, label }: { points: { key: string; label: string; value: number }[]; label: string }) {
  const width = 720, height = 200, left = 30, right = 8, top = 16, bottom = 30;
  const max = Math.max(...points.map((point) => point.value), 0);
  const niceMax = Math.max(2, max + (max % 2));
  const ticks = [0, niceMax / 2, niceMax];
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const slot = plotWidth / Math.max(points.length, 1), barWidth = Math.max(2, Math.min(28, slot - 4));
  const y = (value: number) => top + plotHeight - (value / niceMax) * plotHeight;
  // Con muchos días no caben todas las fechas: se escribe una de cada «every».
  const every = Math.ceil(points.length / 16);
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={label}>
    {ticks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#e5e7eb" strokeWidth="1" /><text x={left - 6} y={y(tick)} dy="0.32em" textAnchor="end" fontSize="11" fill="#6b7280">{tick}</text></g>)}
    {points.map((point, index) => {
      const x = left + index * slot + (slot - barWidth) / 2, barTop = y(point.value), barHeight = top + plotHeight - barTop;
      return <g key={point.key}>
        {point.value > 0 && <path d={barHeight > 4 && barWidth > 8 ? `M${x},${top + plotHeight} V${barTop + 4} Q${x},${barTop} ${x + 4},${barTop} H${x + barWidth - 4} Q${x + barWidth},${barTop} ${x + barWidth},${barTop + 4} V${top + plotHeight} Z` : `M${x},${top + plotHeight} h${barWidth} v${-barHeight} h${-barWidth} Z`} fill={BAR} />}
        {point.value > 0 && points.length <= 31 && <text x={x + barWidth / 2} y={barTop - 4} textAnchor="middle" fontSize="10" fill="#111827">{point.value}</text>}
        {index % every === 0 && <text x={left + index * slot + slot / 2} y={height - 10} textAnchor="middle" fontSize="10" fill="#6b7280">{point.label}</text>}
      </g>;
    })}
    <line x1={left} x2={width - right} y1={top + plotHeight} y2={top + plotHeight} stroke="#d1d5db" strokeWidth="1" />
  </svg>;
}

// Dona del estado de las tareas, con 2 px de separación entre segmentos y leyenda con cantidad y %.
function TaskDonut({ counts }: { counts: Record<(typeof TASK_STATUS)[number]["key"], number> }) {
  const total = TASK_STATUS.reduce((sum, status) => sum + counts[status.key], 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">Sin tareas con fecha límite en estas fechas.</p>;
  const radius = 60, stroke = 22, circumference = 2 * Math.PI * radius, gap = TASK_STATUS.filter((status) => counts[status.key] > 0).length > 1 ? 2 : 0;
  // Largo de cada segmento y dónde empieza (suma de los anteriores).
  const lengths = TASK_STATUS.map((status) => (counts[status.key] / total) * circumference);
  const starts = lengths.map((_, index) => lengths.slice(0, index).reduce((sum, length) => sum + length, 0));
  return <div className="flex flex-wrap items-center gap-6">
    <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label={`Estado de ${total} tareas`}>
      <g transform="rotate(-90 80 80)">{TASK_STATUS.map((status, index) => counts[status.key] > 0 && <circle key={status.key} cx="80" cy="80" r={radius} fill="none" stroke={status.color} strokeWidth={stroke} strokeDasharray={`${Math.max(0, lengths[index] - gap)} ${circumference}`} strokeDashoffset={-starts[index]} />)}</g>
      <text x="80" y="76" textAnchor="middle" fontSize="24" fontWeight="600" fill="#111827">{total}</text>
      <text x="80" y="96" textAnchor="middle" fontSize="11" fill="#6b7280">tareas</text>
    </svg>
    <ul className="grid gap-1.5 text-sm">{TASK_STATUS.map((status) => <li key={status.key} className="flex items-center gap-2"><span className="size-3 shrink-0 rounded-sm" style={{ background: status.color }} aria-hidden="true" /><span>{status.label}</span><strong className="ml-auto pl-4 tabular-nums">{counts[status.key]}</strong><span className="w-12 text-right text-xs text-muted-foreground tabular-nums">{Math.round((counts[status.key] / total) * 100)}%</span></li>)}</ul>
  </div>;
}

export function ReportCharts({ summaries, attendance, from, to, title = "Gráficas", action }: { summaries: Summary[]; attendance: Shift[]; from: string; to: string; title?: string; action?: ReactNode }) {
  const hours = [...summaries].sort((a, b) => b.minutes - a.minutes).map((s) => ({ id: s.staff_id, name: s.name, value: s.minutes, text: hoursLabel(s.minutes) }));
  const warnings = [...summaries].sort((a, b) => b.warnings - a.warnings).map((s) => ({ id: s.staff_id, name: s.name, value: s.warnings, text: String(s.warnings) }));
  const counts = { approved: 0, submitted: 0, overdue: 0, rejected: 0, pending: 0 };
  for (const s of summaries) { counts.approved += s.approved; counts.submitted += s.submitted; counts.overdue += s.overdue; counts.rejected += s.rejected; counts.pending += s.pending; }
  const { monthly, points } = attendancePoints(attendance, from, to);
  return <section className="mt-8"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2>{action}</div>
    <div className="mt-3 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
      <Chart title="Horas trabajadas por trabajador" note="Solo suman las jornadas con salida."><HorizontalBars rows={hours} label="Horas trabajadas por trabajador" empty="Sin horas registradas en estas fechas." /></Chart>
      <Chart title="Estado de las tareas" note="Tareas con fecha límite en el periodo."><TaskDonut counts={counts} /></Chart>
      <Chart wide title={monthly ? "Jornadas por mes" : "Asistencia por día"} note={monthly ? "Llegadas marcadas en cada mes." : "Trabajadores que marcaron llegada cada día."}><ColumnBars points={points} label={monthly ? "Jornadas registradas por mes" : "Trabajadores que marcaron llegada por día"} /></Chart>
      <Chart title="Llamados de atención por trabajador"><HorizontalBars rows={warnings} label="Llamados de atención por trabajador" empty="Sin llamados de atención en estas fechas." /></Chart>
    </div>
  </section>;
}
