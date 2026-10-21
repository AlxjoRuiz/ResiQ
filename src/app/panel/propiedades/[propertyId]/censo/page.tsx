import Link from "next/link";
import { CensusImportForm } from "@/components/census/census-import-form";
import { CensusList, type CensusListRow } from "@/components/census/census-list";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";

function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }

export default async function CensusPage({ params, searchParams }: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ importado?: string }>;
}) {
  const { propertyId } = await params;
  const { importado } = await searchParams;
  const { supabase, property } = await requirePropertyAdmin(propertyId);
  const [{ data, error }, { count: buildingCount, error: buildingError }] = await Promise.all([
    supabase.from("census_records").select("id,full_name,user_type,email_normalized,phone,buildings(name,code),units(code,floor)").eq("property_id", propertyId).limit(500),
    supabase.from("buildings").select("id", { count: "exact", head: true }).eq("property_id", propertyId),
  ]);
  if (error || buildingError) throw new Error("No se pudo cargar el censo de esta propiedad.");
  const rows: CensusListRow[] = (data ?? []).map((item) => {
    const building = one(item.buildings);
    const unit = one(item.units);
    return { id: item.id, tower: building?.name ?? "Sin torre", apartment: unit?.code ?? "Sin apartamento",
      floor: unit?.floor ?? null, fullName: item.full_name, userType: item.user_type,
      phone: item.phone, email: item.email_normalized };
  }).sort((a, b) => a.tower.localeCompare(b.tower, "es", { numeric: true })
    || (a.floor ?? "").localeCompare(b.floor ?? "", "es", { numeric: true })
    || a.apartment.localeCompare(b.apartment, "es", { numeric: true }));
  return <main className="mx-auto min-w-0 max-w-6xl px-4 py-7 sm:px-8">
    <Link href={`/panel/propiedades/${propertyId}`} className="text-sm text-primary hover:underline">← Volver a Propiedad</Link>
    <header className="mt-5 border-b pb-5"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Administración</p><h1 className="mt-2 text-3xl font-semibold">Censo de residentes</h1><p className="mt-2 text-sm text-muted-foreground">{property.name}</p></header>
    {importado === "1" && <p role="status" className="mt-5 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">Censo importado. Las cuentas todavía no están vinculadas; las invitaciones se enviarán después.</p>}
    <section className="mt-7"><Card><CardContent><h2 className="text-lg font-semibold">Respuestas por apartamento</h2><p className="mb-5 mt-1 text-sm text-muted-foreground">Solo Administración puede consultar estas respuestas. El correo del censo no concede acceso a ResiQ.</p><CensusList propertyId={propertyId} rows={rows} /></CardContent></Card></section>
    <section className="mt-7"><Card><CardContent><h2 className="text-lg font-semibold">Importar Excel</h2><p className="mb-5 mt-1 text-sm text-muted-foreground">La primera importación requiere que esta propiedad no tenga torres ni apartamentos. El Excel crea ambos al confirmar.</p>{(buildingCount ?? 0) === 0 ? <CensusImportForm propertyId={propertyId} /> : <p className="rounded-lg bg-secondary p-3 text-sm">Esta propiedad ya tiene una estructura. Para evitar cruces, no se admite otra importación en esta primera entrega.</p>}</CardContent></Card></section>
  </main>;
}
