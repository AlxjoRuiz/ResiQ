import Link from "next/link";
import { Landmark } from "lucide-react";
import { CreateAssemblyForm, type AssemblyDirectoryRow } from "@/components/assemblies/assembly-forms";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

export default async function NewAssemblyPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params; const { supabase, property } = await requirePropertyAdmin(propertyId);
  const { data } = await fetchAllRows((from, to) => supabase.rpc("get_assembly_directory", { target_property_id: propertyId }).order("unit_id").order("member_id").range(from, to)); const directory = (data ?? []) as AssemblyDirectoryRow[];
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 sm:px-10"><Link href={`/panel/propiedades/${propertyId}/asambleas`} className="text-sm text-muted-foreground hover:text-foreground">← Volver a Asambleas</Link><section className="mt-6 rounded-2xl border border-primary/30 bg-card p-6 sm:p-8"><div className="flex items-start gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Landmark size={22} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Nueva convocatoria</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-primary">Crear convocatoria</h1></div></div><p className="mt-2 mb-7 text-sm text-muted-foreground">Completa los datos, selecciona a los convocados y adjunta la convocatoria. Al publicarla se enviará un aviso interno; la asamblea se aprueba cuando más del 50% de los apartamentos confirme asistencia. La selección de convocados no asigna derechos de voto ni calcula quórum.</p><CreateAssemblyForm propertyId={propertyId} directory={directory} timeZone={property.timezone} /></section></main>;
}
