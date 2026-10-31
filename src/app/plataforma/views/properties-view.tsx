import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CreatePropertyForm } from "@/components/dashboard/create-property-form";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { propertyStatusLabel, propertyStatusTone } from "../property-status";
import { loadTestScope } from "../test-scope";

type PropertyRow = { property_id: string; property_name: string; city: string | null; property_status: string; unit_count: number; resident_count: number; administrator_count: number };

// Conjuntos (30/10/2026): crear uno nuevo y la lista; cada conjunto abre su ficha con administración,
// usuarios, uso del mes y su estado. Desde el 31/10/2026 la misma vista sirve para producción y para
// Pruebas ResiQ (test): solo cambia qué conjuntos muestra y que lo creado allí nace como de prueba.
export async function PropertiesView({ test = false }: { test?: boolean }) {
  const { supabase } = await requirePlatformAdmin();
  const [scope, { data, error }] = await Promise.all([loadTestScope(supabase), supabase.rpc("platform_list_properties")]);
  if (error) throw new Error("No se pudieron cargar los conjuntos.");
  const rows = ((data ?? []) as PropertyRow[]).filter((row) => scope.isTestProperty(row.property_id) === test);
  return <>
    <Card id={test ? "nuevo-prueba" : "nuevo"} className="scroll-mt-6"><CardContent><details>
      <summary className="cursor-pointer text-lg font-semibold">{test ? "Nuevo conjunto de prueba" : "Nuevo conjunto"}</summary>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">Crea el conjunto y la invitación de su administrador. El administrador entra con el enlace usando ese correo y después importa el censo.{test ? " Queda en Pruebas ResiQ." : ""}</p>
      <CreatePropertyForm test={test} />
    </details></CardContent></Card>
    <section aria-label={test ? "Lista de conjuntos de prueba" : "Lista de conjuntos"} className="grid gap-3">
      {rows.map((row) => <Link key={row.property_id} href={`/plataforma/propiedades/${row.property_id}`} className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-5 transition-colors hover:border-primary/40 hover:bg-secondary/40">
        <span className="min-w-0"><span className="block text-lg font-semibold">{row.property_name}</span><span className="block text-sm text-muted-foreground">{row.city ?? "Sin ciudad"} · {row.unit_count} apartamentos · {row.resident_count} residentes · {row.administrator_count} {row.administrator_count === 1 ? "administrador" : "administradores"}</span></span>
        <span className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-medium ${propertyStatusTone(row.property_status)}`}>{propertyStatusLabel(row.property_status)}</span><ChevronRight size={18} aria-hidden="true" className="text-muted-foreground" /></span>
      </Link>)}
      {!rows.length && <Card><CardContent><p className="text-sm text-muted-foreground">{test ? "No hay conjuntos de prueba." : "Todavía no hay conjuntos."}</p></CardContent></Card>}
    </section>
  </>;
}
