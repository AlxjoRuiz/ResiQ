"use client";

import { useState } from "react";

export type AttendancePoint = { day: string; workers: number; minutes: number };

// Color validado (azul de la paleta del panel, una sola serie: no necesita leyenda).
const BAR = "#2a78d6";
const dayNumber = (day: string) => String(Number(day.slice(8, 10)));
const longDay = (day: string) => new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
const hours = (minutes: number) => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

// Barras por día (un solo eje): trabajadores que marcaron llegada en los últimos 14 días. Al pasar el
// cursor o enfocar un día se ven también las horas trabajadas; «Ver tabla» muestra los mismos datos.
export function AttendanceChart({ points }: { points: AttendancePoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 560, height = 200, left = 32, right = 8, top = 12, bottom = 28;
  const max = Math.max(...points.map((point) => point.workers), 0);
  const niceMax = Math.max(2, max + (max % 2));
  const ticks = [0, niceMax / 2, niceMax];
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const slot = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.min(24, slot - 8);
  const y = (value: number) => top + plotHeight - (value / niceMax) * plotHeight;
  const point = active === null ? null : points[active];
  return <div className="grid gap-3">
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Trabajadores que marcaron llegada cada día de los últimos 14 días">
        {ticks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#e5e7eb" strokeWidth="1" /><text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize="11" fill="#6b7280">{tick}</text></g>)}
        {points.map((item, index) => {
          const x = left + index * slot + (slot - barWidth) / 2, barTop = y(item.workers), barHeight = top + plotHeight - barTop;
          return <g key={item.day} tabIndex={0} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} className="outline-none" aria-label={`${longDay(item.day)}: ${item.workers} trabajadores, ${hours(item.minutes)}`}>
            <rect x={left + index * slot} y={top} width={slot} height={plotHeight} fill={active === index ? "#f3f4f6" : "transparent"} />
            {item.workers > 0 && <path d={barHeight > 4 ? `M${x},${top + plotHeight} V${barTop + 4} Q${x},${barTop} ${x + 4},${barTop} H${x + barWidth - 4} Q${x + barWidth},${barTop} ${x + barWidth},${barTop + 4} V${top + plotHeight} Z` : `M${x},${top + plotHeight} h${barWidth} v${-barHeight} h${-barWidth} Z`} fill={BAR} />}
            <text x={left + index * slot + slot / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#6b7280">{dayNumber(item.day)}</text>
          </g>;
        })}
        <line x1={left} x2={width - right} y1={top + plotHeight} y2={top + plotHeight} stroke="#d1d5db" strokeWidth="1" />
      </svg>
      {point && active !== null && <div role="status" className="pointer-events-none absolute top-2 rounded-lg border bg-white px-3 py-2 text-xs shadow-md" style={{ left: `${Math.min(62, ((left + active * slot + slot / 2) / width) * 100)}%` }}>
        <p className="font-semibold first-letter:uppercase">{longDay(point.day)}</p>
        <p className="mt-1">Trabajadores: <strong>{point.workers}</strong></p>
        <p className="mt-1">Horas trabajadas: <strong>{hours(point.minutes)}</strong></p>
      </div>}
    </div>
    <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Ver tabla</summary>
      <table className="mt-2 w-full text-left"><thead><tr className="text-muted-foreground"><th className="py-1 font-medium">Día</th><th className="py-1 font-medium">Trabajadores</th><th className="py-1 font-medium">Horas</th></tr></thead>
        <tbody>{points.map((item) => <tr key={item.day} className="border-t"><td className="py-1 first-letter:uppercase">{longDay(item.day)}</td><td className="py-1">{item.workers}</td><td className="py-1">{hours(item.minutes)}</td></tr>)}</tbody></table>
    </details>
  </div>;
}
