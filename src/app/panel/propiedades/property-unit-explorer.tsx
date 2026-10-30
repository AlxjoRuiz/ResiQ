import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { LazyUnit } from "./unit-detail";

export type ExplorerTower = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  edit: ReactNode;
  units: { id: string; code: string; floor: string | null; kind: string | null }[];
};

// Torres y apartamentos de la página Propiedad. Cada apartamento trae su información al abrirlo (LazyUnit).
export function PropertyUnitExplorer({ propertyId, towers, refreshKey }: { propertyId: string; towers: ExplorerTower[]; refreshKey: string }) {
  return <div className="space-y-4">
    {towers.map((tower) => <details key={tower.id} className="min-w-0 overflow-hidden rounded-xl border bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden sm:p-5"><Building2 size={19} aria-hidden="true" className="shrink-0 text-primary" /><span className="min-w-0 flex-1"><strong className="block">{tower.name}</strong><span className="text-xs text-muted-foreground">{tower.units.length} apartamentos {tower.active ? "" : "· Inactiva"}</span></span><span aria-hidden="true" className="text-muted-foreground">▾</span></summary>
      <div className="border-t p-2 sm:p-5">
        <div className="space-y-2">{tower.units.map((unit) => <LazyUnit key={unit.id} propertyId={propertyId} unit={unit} refreshKey={refreshKey} />)}{tower.units.length === 0 && <p className="text-sm text-muted-foreground">No hay apartamentos para mostrar.</p>}</div>
        <details className="mt-5 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Editar esta torre</summary><div className="mt-4">{tower.edit}</div></details>
      </div>
    </details>)}
    {towers.length === 0 && <p className="rounded-lg border p-4 text-sm text-muted-foreground">Todavía no hay torres. Puedes importarlas con el Excel de arriba.</p>}
  </div>;
}
