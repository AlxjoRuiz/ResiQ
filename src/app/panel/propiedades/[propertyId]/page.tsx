import Link from "next/link";
import { Building2, House, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { InvitationCreateForm } from "@/app/panel/invitaciones/nueva/invitation-create-form";
import { PropertyManagementSections } from "../property-sections";

export default async function PropertyManagementPage({ params, searchParams }: { params: Promise<{ propertyId: string }>; searchParams: Promise<{ importado?: string }> }) {
  const { propertyId } = await params;
  const { importado } = await searchParams;
  const { supabase, property } = await requirePropertyAdmin(propertyId);
  const [{ count: buildingCount, error: buildingCountError }, { count: unitCount, error: unitCountError }, { count: residentCount, error: residentCountError }, { data: invitationBuildings, error: invitationBuildingsError }, { data: invitationUnits, error: invitationUnitsError }] = await Promise.all([
    supabase.from("buildings").select("id", { count: "exact", head: true }).eq("property_id", propertyId),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("property_id", propertyId),
    supabase.from("census_records").select("id", { count: "exact", head: true }).eq("property_id", propertyId),
    supabase.from("buildings").select("id,name").eq("property_id", propertyId).eq("active", true).order("name"),
    supabase.from("units").select("id,building_id,code").eq("property_id", propertyId).eq("status", "active").order("code"),
  ]);
  if (buildingCountError || unitCountError || residentCountError || invitationBuildingsError || invitationUnitsError) throw new Error("No se pudieron cargar los datos de la propiedad.");

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 sm:px-10">
    <Button asChild variant="ghost" size="sm"><Link href={`/panel/propiedades/${propertyId}/dashboard`}>← Volver al inicio</Link></Button>
    <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b pb-6"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">Administración</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Propiedad</h1><p className="mt-2 text-sm text-muted-foreground">{property.name} · {[property.address, property.city].filter(Boolean).join(" · ") || "Ubicación sin registrar"}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{property.status === "active" ? "Activa" : property.status}</span></header>
    <section className="mt-8 grid gap-4 sm:grid-cols-3"><Card><CardContent><Building2 className="text-primary" size={20} /><p className="mt-3 text-2xl font-semibold">{buildingCount ?? 0}</p><p className="text-sm text-muted-foreground">Torres o bloques</p></CardContent></Card><Card><CardContent><House className="text-primary" size={20} /><p className="mt-3 text-2xl font-semibold">{unitCount ?? 0}</p><p className="text-sm text-muted-foreground">Apartamentos</p></CardContent></Card><Card><CardContent><UsersRound className="text-primary" size={20} /><p className="mt-3 text-2xl font-semibold">{residentCount ?? 0}</p><p className="text-sm text-muted-foreground">Residentes registrados</p><p className="mt-1 text-xs text-muted-foreground">Datos del censo; no implica acceso a ResiQ.</p></CardContent></Card></section>
    <nav aria-label="Administrar propiedad" className="mt-7 flex flex-wrap gap-2 text-sm"><a href="#apartamentos" className="rounded-full border px-4 py-2 hover:bg-secondary">Torres de la propiedad</a><a href="#invitaciones" className="rounded-full border px-4 py-2 hover:bg-secondary">Invitaciones</a><a href="#porteria" className="rounded-full border px-4 py-2 hover:bg-secondary">Portería</a></nav>
    <PropertyManagementSections propertyId={propertyId} canImport={(buildingCount ?? 0) === 0} imported={importado === "1"} />
    <section id="invitaciones" className="mt-10 scroll-mt-6"><h2 className="text-2xl font-semibold">Invitaciones de residentes</h2><p className="mt-1 text-sm text-muted-foreground">Selecciona la torre y el apartamento existente al invitar a un residente. Los porteros se registran en «Personal de portería».</p><Card className="mt-4"><CardContent><InvitationCreateForm propertyId={propertyId} buildings={invitationBuildings ?? []} units={(invitationUnits ?? []).map((unit) => ({ id: unit.id, buildingId: unit.building_id, code: unit.code }))} /></CardContent></Card></section>
  </main>;
}
