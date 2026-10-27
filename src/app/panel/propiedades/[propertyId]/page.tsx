import Link from "next/link";
import { Building2, House, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { PropertyManagementSections } from "../property-sections";
import { PropertyAddressForm } from "../management-forms";

export default async function PropertyManagementPage({ params, searchParams }: { params: Promise<{ propertyId: string }>; searchParams: Promise<{ importado?: string }> }) {
  const { propertyId } = await params;
  const { importado } = await searchParams;
  const { supabase, property } = await requirePropertyAdmin(propertyId);
  const [{ count: buildingCount, error: buildingCountError }, { count: unitCount, error: unitCountError }, { count: residentCount, error: residentCountError }] = await Promise.all([
    supabase.from("buildings").select("id", { count: "exact", head: true }).eq("property_id", propertyId),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("property_id", propertyId),
    supabase.from("census_records").select("id", { count: "exact", head: true }).eq("property_id", propertyId),
  ]);
  if (buildingCountError || unitCountError || residentCountError) throw new Error("No se pudieron cargar los datos de la propiedad.");

  return <main className="mx-auto min-h-screen max-w-6xl px-3 py-8 sm:px-10">
    <Button asChild variant="ghost" size="sm"><Link href={`/panel/propiedades/${propertyId}/dashboard`}>← Volver al inicio</Link></Button>
    <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b pb-6"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">Administración</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Propiedad</h1><p className="mt-2 text-sm text-muted-foreground">{property.name} · {[property.address, property.city].filter(Boolean).join(" · ") || "Ubicación sin registrar"}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{property.status === "active" ? "Activa" : property.status}</span></header>
    <section className="mt-8 grid gap-4 sm:grid-cols-3"><Card><CardContent><Building2 className="text-primary" size={20} /><p className="mt-3 text-2xl font-semibold">{buildingCount ?? 0}</p><p className="text-sm text-muted-foreground">Torres o bloques</p></CardContent></Card><Card><CardContent><House className="text-primary" size={20} /><p className="mt-3 text-2xl font-semibold">{unitCount ?? 0}</p><p className="text-sm text-muted-foreground">Apartamentos</p></CardContent></Card><Card><CardContent><UsersRound className="text-primary" size={20} /><p className="mt-3 text-2xl font-semibold">{residentCount ?? 0}</p><p className="text-sm text-muted-foreground">Residentes registrados</p><p className="mt-1 text-xs text-muted-foreground">Datos del censo; no implica acceso a ResiQ.</p></CardContent></Card></section>
    <nav aria-label="Administrar propiedad" className="mt-7 flex flex-wrap gap-2 text-sm"><a href="#apartamentos" className="rounded-full border px-4 py-2 hover:bg-secondary">Torres de la propiedad</a><a href="#porteria" className="rounded-full border px-4 py-2 hover:bg-secondary">Portería</a><a href="#direccion" className="rounded-full border px-4 py-2 hover:bg-secondary">Dirección</a></nav>
    <PropertyManagementSections propertyId={propertyId} canImport={(buildingCount ?? 0) === 0} imported={importado === "1"} />
    <section id="direccion" className="mt-10 scroll-mt-6">
      <h2 className="text-2xl font-semibold">Dirección del conjunto</h2>
      <p className="mt-1 text-sm text-muted-foreground">La dirección de {property.name}.</p>
      <Card className="mt-4"><CardContent><PropertyAddressForm key={`${property.name}|${property.address ?? ""}|${property.city ?? ""}`} property={property} /></CardContent></Card>
    </section>
  </main>;
}
