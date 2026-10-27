import Link from "next/link";
import { CreatePropertyForm } from "@/components/dashboard/create-property-form";
import { PropertyStatusForm } from "@/components/dashboard/platform-forms";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

type PropertyRow = { property_id: string; property_name: string; city: string | null; property_status: string; unit_count: number; administrator_count: number };

// Superadmin: crear conjuntos y suspenderlos o reactivarlos.
export default async function PlatformPropertiesPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("platform_list_properties");
  if (error) throw new Error("No se pudieron cargar los conjuntos.");
  const rows = (data ?? []) as PropertyRow[];
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-7 sm:px-10">
    <Link href="/plataforma" className="text-sm text-muted-foreground hover:text-foreground">← Volver a la plataforma</Link>
    <header className="mt-5 border-b pb-6"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Plataforma</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Propiedades</h1></header>
    <Card className="mt-7"><CardContent><h2 className="text-xl font-semibold">Nuevo conjunto</h2><p className="mt-1 mb-5 text-sm text-muted-foreground">Crea el conjunto y la invitación de su administrador. El administrador entra con el enlace usando ese correo y después importa el censo.</p><CreatePropertyForm /></CardContent></Card>
    <section className="mt-8"><h2 className="text-xl font-semibold">Conjuntos</h2><p className="mt-1 text-sm text-muted-foreground">Suspender bloquea el acceso de todo el conjunto sin borrar datos; reactivar lo devuelve como estaba.</p>
      <div className="mt-4 grid gap-4">{rows.map((row) => { const suspended = row.property_status === "suspended"; return <Card key={row.property_id}><CardContent>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{row.property_name}</h3><p className="text-sm text-muted-foreground">{row.city ?? "Sin ciudad"} · {row.unit_count} apartamentos · {row.administrator_count} {row.administrator_count === 1 ? "administrador" : "administradores"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${suspended ? "bg-amber-100 text-amber-900" : "bg-primary/12 text-primary"}`}>{suspended ? "Suspendido" : row.property_status === "active" ? "Activo" : "Archivado"}</span></div>
        {row.property_status !== "archived" && <div className="mt-4 border-t pt-4"><PropertyStatusForm key={row.property_status} propertyId={row.property_id} propertyName={row.property_name} suspended={suspended} /></div>}
      </CardContent></Card>; })}
      {!rows.length && <Card><CardContent><p className="text-sm text-muted-foreground">Todavía no hay conjuntos.</p></CardContent></Card>}</div>
    </section>
  </main>;
}
