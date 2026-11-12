import type { ReactNode } from "react";
import { TowerPanel } from "./tower-panel";

type ExplorerTower = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  edit: ReactNode;
  units: { id: string; code: string; floor: string | null; kind: string | null }[];
};

// Torres y apartamentos de la página Propiedad. Cada torre dibuja sus apartamentos al abrirla (TowerPanel) y cada
// apartamento trae su información al abrirlo (LazyUnit).
export function PropertyUnitExplorer({ propertyId, towers, refreshKey }: { propertyId: string; towers: ExplorerTower[]; refreshKey: string }) {
  return <div className="space-y-4">
    {towers.map((tower) => <TowerPanel key={tower.id} propertyId={propertyId} name={tower.name} active={tower.active} units={tower.units} edit={tower.edit} refreshKey={refreshKey} />)}
    {towers.length === 0 && <p className="rounded-lg border p-4 text-sm text-muted-foreground">Todavía no hay torres. Puedes importarlas con el Excel de arriba.</p>}
  </div>;
}
