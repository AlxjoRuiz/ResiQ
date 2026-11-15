import type { ReactNode } from "react";
import { ChevronDown, Plus, type LucideIcon } from "lucide-react";

// Piezas de diseño comunes (14/11/2026, pedido de Alejandro): el mismo aspecto de las tarjetas que ya se mejoraron
// (comprobantes, saldo a favor, llamados de atención). Solo aspecto: no cambian formularios ni acciones.

/** Sección desplegable con borde azul para crear algo («Nueva tarea», «Nuevo trabajador»…). */
export function CreatePanel({ title, description, children, className = "mt-6", icon: Icon = Plus }: { title: string; description?: string; children: ReactNode; className?: string; icon?: LucideIcon }) {
  return <details className={`group rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5 ${className}`}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
      <span className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Icon size={18} aria-hidden="true" /></span>
        <span className="min-w-0"><span className="block font-semibold text-primary">{title}</span>{description && <span className="block text-xs text-muted-foreground">{description}</span>}</span></span>
      <ChevronDown size={18} className="shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className="mt-5 rounded-xl border bg-card p-4 sm:p-5">{children}</div>
  </details>;
}

/** Desplegable secundario dentro de una tarjeta («Ver detalles», «Editar»…): texto azul con flecha. */
export const subtleSummary = "cursor-pointer text-sm font-medium text-primary";

/** Encabezado de una tarjeta de lista: ícono, título azul, subtítulo y la etiqueta de estado a la derecha. */
export function ItemHeader({ icon: Icon, iconClass = "bg-primary/10 text-primary", title, subtitle, badge, as: Tag = "h2" }: { icon?: LucideIcon; iconClass?: string; title: ReactNode; subtitle?: ReactNode; badge?: ReactNode; as?: "h2" | "h3" | "p" }) {
  return <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="flex min-w-0 items-start gap-3">{Icon && <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}><Icon size={18} aria-hidden="true" /></span>}
      <div className="min-w-0"><Tag className="break-words font-semibold text-primary">{title}</Tag>{subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}</div></div>
    {badge}
  </div>;
}

/** Datos de la tarjeta en recuadros grises (Valor, Fecha…), como en los comprobantes. */
export function FactGrid({ facts, className = "mt-3", columns = "grid-cols-2" }: { facts: { label: string; value: ReactNode; wide?: boolean }[]; className?: string; columns?: string }) {
  return <dl className={`grid gap-2 text-sm ${columns} ${className}`}>
    {facts.map((fact) => <div key={fact.label} className={`min-w-0 rounded-lg bg-secondary/60 px-3 py-2 ${fact.wide ? "col-span-full" : ""}`}><dt className="text-xs text-muted-foreground">{fact.label}</dt><dd className="break-words font-medium">{fact.value}</dd></div>)}
  </dl>;
}

/** Texto largo (descripción, nota) en un recuadro gris con su etiqueta. */
export function TextBlock({ label, children, className = "mt-3" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={`rounded-lg bg-secondary/60 px-3 py-2 ${className}`}><p className="text-xs text-muted-foreground">{label}</p><div className="mt-0.5 whitespace-pre-line text-sm">{children}</div></div>;
}

/** Barra de filtros en un recuadro suave. */
export const filterBar = "mt-6 flex flex-wrap items-end gap-3 rounded-2xl border bg-secondary/30 p-4";
