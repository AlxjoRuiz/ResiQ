import type { ReactNode } from "react";
import { Building2, House } from "lucide-react";

export type ExplorerTower = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  edit: ReactNode;
  units: { id: string; code: string; floor: string | null; kind: string | null; content: ReactNode }[];
};

export function PropertyUnitExplorer({ towers }: { towers: ExplorerTower[] }) {
  return <div className="space-y-4">
    {towers.map((tower) => <details key={tower.id} className="min-w-0 overflow-hidden rounded-xl border bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden sm:p-5"><Building2 size={19} aria-hidden="true" className="shrink-0 text-primary" /><span className="min-w-0 flex-1"><strong className="block">{tower.name}</strong><span className="text-xs text-muted-foreground">{tower.units.length} apartamentos {tower.active ? "" : "· Inactiva"}</span></span><span aria-hidden="true" className="text-muted-foreground">▾</span></summary>
      <div className="border-t p-3 sm:p-5">
        <div className="space-y-2">{tower.units.map((unit) => <details key={unit.id} id={`apartamento-${unit.id}`} className="min-w-0 rounded-lg border bg-background">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-3 marker:hidden sm:p-4"><House size={17} aria-hidden="true" className="shrink-0 text-primary" /><span className="min-w-0 flex-1 font-medium">Apartamento {unit.code}{unit.kind && <span className="font-normal text-muted-foreground"> · {unit.kind}</span>}</span><span aria-hidden="true" className="text-muted-foreground">▾</span></summary>
          <div className="min-w-0 space-y-4 border-t p-3 sm:p-4">{unit.content}</div>
        </details>)}{tower.units.length === 0 && <p className="text-sm text-muted-foreground">No hay apartamentos para mostrar.</p>}</div>
        <details className="mt-5 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Editar esta torre</summary><div className="mt-4">{tower.edit}</div></details>
      </div>
    </details>)}
    {towers.length === 0 && <p className="rounded-lg border p-4 text-sm text-muted-foreground">Todavía no hay torres. Puedes importarlas con el Excel de arriba.</p>}
  </div>;
}
