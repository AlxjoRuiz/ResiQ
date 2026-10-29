"use client";

import { useState } from "react";

export type CollectionPoint = { month: string; billed: number; collected: number };

// Colores validados (categórica, fondo claro): facturado = naranja, recaudado = azul.
const SERIES = [
  { key: "billed", label: "Facturado", color: "#eb6834" },
  { key: "collected", label: "Recaudado", color: "#2a78d6" },
] as const;
const cop = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const short = (value: number) => value >= 1_000_000 ? `$${(value / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M` : value >= 1_000 ? `$${Math.round(value / 1_000)} mil` : cop(value);
const monthLabel = (month: string) => new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`)).replace(".", "");

// Barras agrupadas por mes (un solo eje): facturado contra recaudado de los últimos 6 meses. Al pasar
// el cursor o enfocar un mes se ve el detalle; «Ver tabla» muestra los mismos datos.
export function CollectionChart({ points }: { points: CollectionPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 560, height = 220, left = 56, right = 8, top = 12, bottom = 28;
  const max = Math.max(1, ...points.flatMap((point) => [point.billed, point.collected]));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [0, niceMax / 2, niceMax];
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const groupWidth = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.min(22, (groupWidth - 18) / 2);
  const y = (value: number) => top + plotHeight - (value / niceMax) * plotHeight;
  const point = active === null ? null : points[active];
  return <div className="grid gap-3">
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">{SERIES.map((series) => <span key={series.key} className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: series.color }} />{series.label}</span>)}</div>
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Facturado y recaudado de los últimos 6 meses">
        {ticks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#e5e7eb" strokeWidth="1" /><text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize="11" fill="#6b7280">{short(tick)}</text></g>)}
        {points.map((item, index) => {
          const x0 = left + index * groupWidth + (groupWidth - (barWidth * 2 + 2)) / 2;
          return <g key={item.month} tabIndex={0} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} className="outline-none" aria-label={`${monthLabel(item.month)}: facturado ${cop(item.billed)}, recaudado ${cop(item.collected)}`}>
            <rect x={left + index * groupWidth} y={top} width={groupWidth} height={plotHeight} fill={active === index ? "#f3f4f6" : "transparent"} />
            {SERIES.map((series, position) => { const value = item[series.key]; const barTop = y(value); const barHeight = Math.max(top + plotHeight - barTop, value > 0 ? 2 : 0); return <path key={series.key} d={barHeight > 4 ? `M${x0 + position * (barWidth + 2)},${top + plotHeight} V${barTop + 4} Q${x0 + position * (barWidth + 2)},${barTop} ${x0 + position * (barWidth + 2) + 4},${barTop} H${x0 + position * (barWidth + 2) + barWidth - 4} Q${x0 + position * (barWidth + 2) + barWidth},${barTop} ${x0 + position * (barWidth + 2) + barWidth},${barTop + 4} V${top + plotHeight} Z` : `M${x0 + position * (barWidth + 2)},${top + plotHeight} h${barWidth} v${-barHeight} h${-barWidth} Z`} fill={series.color} />; })}
            <text x={left + index * groupWidth + groupWidth / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#6b7280" className="capitalize">{monthLabel(item.month)}</text>
          </g>;
        })}
        <line x1={left} x2={width - right} y1={top + plotHeight} y2={top + plotHeight} stroke="#d1d5db" strokeWidth="1" />
      </svg>
      {point && active !== null && <div role="status" className="pointer-events-none absolute top-2 rounded-lg border bg-white px-3 py-2 text-xs shadow-md" style={{ left: `${Math.min(70, ((left + active * groupWidth + groupWidth / 2) / width) * 100)}%` }}>
        <p className="font-semibold capitalize">{new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${point.month}-01T12:00:00Z`))}</p>
        {SERIES.map((series) => <p key={series.key} className="mt-1 flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-sm" style={{ background: series.color }} />{series.label}: <strong>{cop(point[series.key])}</strong></p>)}
        <p className="mt-1 text-muted-foreground">{point.billed > 0 ? `${Math.round((point.collected / point.billed) * 100)}% recaudado` : "Sin facturación"}</p>
      </div>}
    </div>
    <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Ver tabla</summary>
      <table className="mt-2 w-full text-left"><thead><tr className="text-muted-foreground"><th className="py-1 font-medium">Mes</th><th className="py-1 font-medium">Facturado</th><th className="py-1 font-medium">Recaudado</th></tr></thead>
        <tbody>{points.map((item) => <tr key={item.month} className="border-t"><td className="py-1 capitalize">{monthLabel(item.month)} {item.month.slice(0, 4)}</td><td className="py-1">{cop(item.billed)}</td><td className="py-1">{cop(item.collected)}</td></tr>)}</tbody></table>
    </details>
  </div>;
}
