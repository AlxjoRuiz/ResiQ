import Link from "next/link";
import { CreateAssemblyForm, type AssemblyDirectoryRow } from "@/components/assemblies/assembly-forms";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";

export default async function NewAssemblyPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params; const { supabase, property } = await requirePropertyAdmin(propertyId);
  const { data } = await supabase.rpc("get_assembly_directory", { target_property_id: propertyId }); const directory = (data ?? []) as AssemblyDirectoryRow[];
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 sm:px-10"><Link href={`/panel/propiedades/${propertyId}/asambleas`} className="text-sm text-muted-foreground hover:text-foreground">← Asambleas de {property.name}</Link><section className="mt-6 rounded-2xl border bg-card p-6 sm:p-8"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Nueva convocatoria</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Crear borrador de asamblea</h1><p className="mt-2 mb-7 text-sm text-muted-foreground">Selecciona expresamente a cada convocado y su apartamento de contexto. Esto no asigna derechos de voto ni calcula quórum.</p><CreateAssemblyForm propertyId={propertyId} directory={directory} /></section></main>;
}
