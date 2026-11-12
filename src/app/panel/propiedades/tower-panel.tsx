"use client";

import { useState, type ReactNode } from "react";
import { Building2 } from "lucide-react";
import { LazyUnit } from "./unit-detail";

type Unit = { id: string; code: string; floor: string | null; kind: string | null };

// Torre de la página Propiedad (12/11/2026): sus apartamentos se dibujan solo al abrirla. Antes se dibujaban los
// 1.860 apartamentos de Bonavento aunque todas las torres estuvieran cerradas (unos 3,4 MB y 3 s por carga).
// Una vez abierta se conserva, para no perder lo que se haya abierto adentro.
export function TowerPanel({ propertyId, name, active, units, edit, refreshKey }: { propertyId: string; name: string; active: boolean; units: Unit[]; edit: ReactNode; refreshKey: string }) {
  const [opened, setOpened] = useState(false);
  return <details className="min-w-0 overflow-hidden rounded-xl border bg-white" onToggle={(event) => { if (event.currentTarget.open) setOpened(true); }}>
    <summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden sm:p-5"><Building2 size={19} aria-hidden="true" className="shrink-0 text-primary" /><span className="min-w-0 flex-1"><strong className="block">{name}</strong><span className="text-xs text-muted-foreground">{units.length} apartamentos {active ? "" : "· Inactiva"}</span></span><span aria-hidden="true" className="text-muted-foreground">▾</span></summary>
    {opened && <div className="border-t p-2 sm:p-5">
      <div className="space-y-2">{units.map((unit) => <LazyUnit key={unit.id} propertyId={propertyId} unit={unit} refreshKey={refreshKey} />)}{units.length === 0 && <p className="text-sm text-muted-foreground">No hay apartamentos para mostrar.</p>}</div>
      <details className="mt-5 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Editar esta torre</summary><div className="mt-4">{edit}</div></details>
    </div>}
  </details>;
}
