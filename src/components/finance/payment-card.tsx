import type { ReactNode } from "react";
import { formatCop } from "@/lib/finance/constants";
import { statusPill, type StatusTone } from "@/lib/ui/status-tones";

// Tarjeta común de «Comprobantes de pago» (13/11/2026, pedido de Alejandro): los comprobantes y las solicitudes de
// saldo a favor se ven igual: título azul, tipo, estado, datos en recuadros, a qué deudas se abona y las acciones.
export type PaymentCardFact = { label: string; value: ReactNode };

export function PaymentCard({ title, kind, status, facts, allocations, allocationNote, children }: {
  title: string; kind: string; status: { label: string; tone: StatusTone }; facts: PaymentCardFact[];
  allocations: { key: string; concept: string; amount: number | null }[]; allocationNote?: ReactNode; children?: ReactNode;
}) {
  return <article className="rounded-xl border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p className="break-words font-semibold text-primary">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{kind}</p></div>
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill[status.tone]}`}>{status.label}</span>
    </div>
    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
      {facts.map((fact) => <div key={fact.label} className="min-w-0 rounded-lg bg-secondary/60 px-3 py-2"><dt className="text-xs text-muted-foreground">{fact.label}</dt><dd className="break-words font-medium">{fact.value}</dd></div>)}
    </dl>
    {allocations.length > 0 && <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <p className="text-xs font-medium text-primary">Se abona así (lo eligió el residente)</p>
      <ul className="mt-1 grid gap-0.5">{allocations.map((item) => <li key={item.key} className="flex justify-between gap-3"><span className="min-w-0">{item.concept}</span>{item.amount !== null && <span className="shrink-0 font-medium">{formatCop(item.amount)}</span>}</li>)}</ul>
      {allocationNote && <p className="mt-1 text-xs text-muted-foreground">{allocationNote}</p>}
    </div>}
    {children}
  </article>;
}
