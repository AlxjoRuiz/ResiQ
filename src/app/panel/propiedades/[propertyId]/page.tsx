import Link from "next/link";
import { Building2, House, ShieldCheck, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { PropertyForm } from "../management-forms";

export default async function PropertyManagementPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase, property } = await requirePropertyAdmin(propertyId);
  const [{ count: buildingCount }, { count: unitCount }, { count: memberCount }] = await Promise.all([
    supabase.from("buildings").select("id", { count: "exact", head: true }).eq("property_id", propertyId),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("property_id", propertyId),
    supabase.from("property_members").select("id", { count: "exact", head: true }).eq("property_id", propertyId).eq("status", "active"),
  ]);

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 sm:px-10">
    <Button asChild variant="ghost" size="sm"><Link href="/panel">← Volver al panel</Link></Button>
    <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b pb-6"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">Administración</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{property.name}</h1><p className="mt-2 text-sm text-muted-foreground">{[property.address, property.city].filter(Boolean).join(" · ") || "Ubicación sin registrar"}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{property.status === "active" ? "Activa" : property.status}</span></header>
    <section className="mt-8 grid gap-4 sm:grid-cols-3"><Card><CardContent><Building2 className="text-primary" size={20} /><p className="mt-3 text-2xl font-semibold">{buildingCount ?? 0}</p><p className="text-sm text-muted-foreground">Torres o bloques</p></CardContent></Card><Card><CardContent><House className="text-primary" size={20} /><p className="mt-3 text-2xl font-semibold">{unitCount ?? 0}</p><p className="text-sm text-muted-foreground">Apartamentos</p></CardContent></Card><Card><CardContent><UsersRound className="text-primary" size={20} /><p className="mt-3 text-2xl font-semibold">{memberCount ?? 0}</p><p className="text-sm text-muted-foreground">Miembros activos</p></CardContent></Card></section>
    <section className="mt-8 grid gap-5 md:grid-cols-2"><Card><CardContent><h2 className="text-lg font-semibold">Estructura de la propiedad</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Crea y administra torres, apartamentos, pisos y estados.</p><Button asChild className="mt-5"><Link href={`/panel/propiedades/${propertyId}/estructura`}>Gestionar estructura</Link></Button></CardContent></Card><Card><CardContent><h2 className="text-lg font-semibold">Miembros y relaciones</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Administra roles y vínculos con uno o varios apartamentos.</p><Button asChild className="mt-5"><Link href={`/panel/propiedades/${propertyId}/miembros`}>Gestionar miembros</Link></Button></CardContent></Card></section>
    <Card className="mt-8"><CardContent><div className="mb-6 flex items-center gap-2"><ShieldCheck size={20} className="text-primary" /><h2 className="text-lg font-semibold">Datos generales</h2></div><PropertyForm property={property} /></CardContent></Card>
  </main>;
}
