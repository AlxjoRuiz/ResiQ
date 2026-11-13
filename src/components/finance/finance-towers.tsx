"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { accountStatusLabel, formatCop } from "@/lib/finance/constants";

// Estado por apartamento de Cartera (12/11/2026): una pestaña plegable por torre. El servidor manda solo los datos
// de cada apartamento y la tabla se dibuja al abrir la torre; antes la página traía las 1.860 filas ya dibujadas
// (5,5 MB en Bonavento) y tardaba más de 4 segundos.
type FinanceTowerUnit = { id: string; code: string; concepts: string; status: string; owed: number; late: number; days: number; legal: boolean; dot: boolean };
export type FinanceTower = { name: string; units: FinanceTowerUnit[] };

function TowerTable({ tower, propertyId, admin }: { tower: FinanceTower; propertyId: string; admin: boolean }) {
  return <div role="region" aria-label={`Apartamentos de ${tower.name}, tabla desplazable`} tabIndex={0} className="max-w-full overflow-x-auto border-t"><table className="w-full min-w-[680px] whitespace-nowrap text-left text-sm">
    <thead className="text-xs uppercase tracking-wide text-primary-foreground"><tr className="bg-primary"><th className="px-4 py-3">Apartamento</th><th className="px-4 py-3">Concepto</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Saldo</th><th className="px-4 py-3">Vencido</th><th className="px-4 py-3">Mora</th><th className="px-4 py-3"></th></tr></thead>
    <tbody>{tower.units.map((unit) => <tr key={unit.id} className="border-t">
      <td className="px-4 py-3 font-medium">{unit.code}{unit.legal && <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 align-middle">En cobro jurídico</span>}</td>
      <td className="max-w-72 px-4 py-3 whitespace-normal text-muted-foreground">{unit.concepts || "—"}</td>
      <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-medium ${unit.status === "overdue" ? "bg-urgent/10 text-urgent" : unit.status === "current" ? "bg-primary/12 text-primary" : "bg-secondary"}`}>{accountStatusLabel(unit.status)}</span></td>
      <td className="px-4 py-3">{formatCop(unit.owed)}</td><td className="px-4 py-3">{formatCop(unit.late)}</td><td className="px-4 py-3">{unit.days} días</td>
      <td className="px-4 py-3 text-right"><Button asChild size="sm"><Link href={`/panel/propiedades/${propertyId}/cartera/${unit.id}`} className="relative">Ver cuenta{unit.dot && <><span aria-hidden="true" className="absolute -top-1 -right-1 size-2.5 rounded-full bg-red-500 ring-2 ring-white" /><span className="sr-only">{admin ? " (comprobante sin registrar)" : " (deuda por pagar)"}</span></>}</Link></Button></td>
    </tr>)}</tbody>
  </table></div>;
}

function TowerSection({ tower, propertyId, admin, startOpen }: { tower: FinanceTower; propertyId: string; admin: boolean; startOpen: boolean }) {
  const [opened, setOpened] = useState(startOpen);
  const owed = tower.units.reduce((sum, unit) => sum + unit.owed, 0), late = tower.units.reduce((sum, unit) => sum + unit.late, 0), lateCount = tower.units.filter((unit) => unit.status === "overdue").length;
  return <details open={startOpen} onToggle={(event) => { if (event.currentTarget.open) setOpened(true); }} className="group overflow-hidden rounded-2xl border bg-card">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-1 px-4 py-4 marker:hidden hover:bg-secondary/60 sm:px-5"><span className="min-w-28 text-base font-semibold">{tower.name}</span><span className="text-sm text-muted-foreground">{tower.units.length} {tower.units.length === 1 ? "apartamento" : "apartamentos"}</span><span className={`text-sm ${lateCount ? "font-medium text-urgent" : "text-muted-foreground"}`}>{lateCount} en mora</span><span className="text-sm">Saldo <strong>{formatCop(owed)}</strong></span><span className="text-sm">Vencido <strong className={late ? "text-urgent" : ""}>{formatCop(late)}</strong></span><span aria-hidden="true" className="ml-auto text-muted-foreground transition-transform group-open:rotate-180">▾</span></summary>
    {opened && <TowerTable tower={tower} propertyId={propertyId} admin={admin} />}
  </details>;
}

export function FinanceTowers({ towers, propertyId, admin }: { towers: FinanceTower[]; propertyId: string; admin: boolean }) {
  return <div className="grid gap-3">{towers.map((tower) => <TowerSection key={tower.name} tower={tower} propertyId={propertyId} admin={admin} startOpen={towers.length === 1} />)}</div>;
}
