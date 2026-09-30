import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { BuildingForm, UnitForm } from "../../management-forms";

type Unit = { id: string; building_id: string; code: string; floor: string | null; status: string };
type Building = { id: string; name: string; code: string; active: boolean; units: Unit[] | null };

export default async function PropertyStructurePage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase, property } = await requirePropertyAdmin(propertyId);
  const { data } = await supabase.from("buildings").select("id,name,code,active,units(id,building_id,code,floor,status)").eq("property_id", propertyId).order("name");
  const buildings = (data ?? []) as Building[];
  const buildingOptions = buildings.map(({ id, name, active }) => ({ id, name, active }));

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 sm:px-10">
    <Button asChild variant="ghost" size="sm"><Link href={`/panel/propiedades/${propertyId}`}>← Volver a {property.name}</Link></Button>
    <header className="mt-5 border-b pb-6"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Estructura</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Torres y apartamentos</h1><p className="mt-2 text-sm text-muted-foreground">Los registros se desactivan para conservar su historial.</p></header>
    <Card className="mt-8"><CardContent><h2 className="mb-5 text-lg font-semibold">Crear torre o bloque</h2><BuildingForm propertyId={propertyId} /></CardContent></Card>
    <Card className="mt-5"><CardContent><h2 className="mb-5 text-lg font-semibold">Crear apartamento</h2><UnitForm propertyId={propertyId} buildings={buildingOptions} /></CardContent></Card>
    <section className="mt-8 space-y-5">{buildings.map((building) => <Card key={building.id}><CardContent><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">{building.code}</p><h2 className="mt-1 text-xl font-semibold">{building.name}</h2></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{building.active ? "Activa" : "Inactiva"}</span></div><div className="mt-5"><BuildingForm propertyId={propertyId} building={building} /></div><div className="mt-6 space-y-3 border-t pt-5">{(building.units ?? []).sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true })).map((unit) => <div key={unit.id} className="rounded-xl border p-4"><UnitForm propertyId={propertyId} buildings={buildingOptions} unit={unit} /></div>)}{!building.units?.length && <p className="text-sm text-muted-foreground">Esta torre todavía no tiene apartamentos.</p>}</div></CardContent></Card>)}{!buildings.length && <Card><CardContent><p className="text-sm text-muted-foreground">Crea la primera torre para comenzar.</p></CardContent></Card>}</section>
  </main>;
}
