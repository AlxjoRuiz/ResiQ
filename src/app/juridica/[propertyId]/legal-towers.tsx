"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCop } from "@/lib/finance/constants";

// Apartamentos de un conjunto para la abogada, por torre (13/11/2026, pedido de Alejandro): una tarjeta plegable por
// torre, de menor a mayor, con sus apartamentos también de menor a mayor. Cada torre dibuja sus apartamentos al
// abrirla, para que la página no pese con conjuntos grandes (1.593 en mora en Bonavento).
// caseLabel/caseTone (13/11/2026): estado del expediente prejurídico, si el apartamento tiene uno abierto.
type LegalTowerUnit = { id: string; code: string; owner: string | null; amount: number; days: number; lastPayment: string; agreement: boolean; inArrears: boolean; outstanding: number; caseLabel?: string | null; caseTone?: string | null };
export type LegalTower = { name: string; units: LegalTowerUnit[] };

function TowerCard({ tower, propertyId, arrears, startOpen }: { tower: LegalTower; propertyId: string; arrears: boolean; startOpen: boolean }) {
  const [opened, setOpened] = useState(startOpen);
  const total = tower.units.reduce((sum, unit) => sum + unit.amount, 0);
  const oldest = Math.max(0, ...tower.units.map((unit) => unit.days));
  return <details open={startOpen} onToggle={(event) => { if (event.currentTarget.open) setOpened(true); }} className="group overflow-hidden rounded-xl border bg-white">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 marker:hidden hover:bg-secondary/60">
      <span className="min-w-24 font-semibold">{tower.name}</span>
      <span className="text-sm text-muted-foreground">{tower.units.length} {tower.units.length === 1 ? "apartamento" : "apartamentos"}{arrears ? " en mora" : ""}</span>
      {arrears ? <><span className="text-sm">Vencido <strong className="text-urgent">{formatCop(total)}</strong></span><span className="text-sm text-muted-foreground">Hasta {oldest} días de mora</span></>
        : <span className="text-sm">Saldo sin vencer <strong>{formatCop(total)}</strong></span>}
      <span aria-hidden="true" className="ml-auto text-muted-foreground transition-transform group-open:rotate-180">▾</span>
    </summary>
    {opened && <ul className="grid gap-2 border-t p-3">{tower.units.map((unit) => <li key={unit.id}><Link href={`/juridica/${propertyId}/${unit.id}`} className="grid gap-2 rounded-xl border p-3 text-sm transition-colors hover:bg-secondary sm:grid-cols-[1fr_auto] sm:items-center">
      <span className="min-w-0"><span className="flex flex-wrap items-center gap-2 font-medium">Apto. {unit.code}{unit.agreement && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">Acuerdo de pago</span>}{unit.caseLabel && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${unit.caseTone ?? "bg-secondary"}`}>{unit.caseLabel}</span>}</span>
        <span className="block truncate text-muted-foreground">{unit.owner ?? "Sin nombre en el censo"}</span>
        <span className="block text-xs text-muted-foreground">Último pago: {unit.lastPayment}</span></span>
      <span className="sm:text-right"><span className={`block font-semibold ${unit.inArrears ? "text-urgent" : ""}`}>{formatCop(unit.amount)}</span>
        <span className="block text-xs text-muted-foreground">{unit.days > 0 ? `${unit.days} días de mora` : unit.outstanding > 0 ? "Saldo sin vencer" : "Sin saldo"}</span></span>
    </Link></li>)}</ul>}
  </details>;
}

export function LegalTowers({ towers, propertyId, arrears }: { towers: LegalTower[]; propertyId: string; arrears: boolean }) {
  // Si el filtro deja una sola torre, se abre de una vez.
  return <div className="grid gap-2">{towers.map((tower) => <TowerCard key={tower.name} tower={tower} propertyId={propertyId} arrears={arrears} startOpen={towers.length === 1} />)}</div>;
}
