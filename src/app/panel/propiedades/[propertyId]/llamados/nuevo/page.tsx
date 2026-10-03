import Link from "next/link";
import { CreateAttentionCallForm, type AttentionDirectoryRow } from "@/components/attention-calls/attention-call-forms";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";

export default async function NewAttentionCallPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase, property } = await requirePropertyAdmin(propertyId);
  const { data } = await supabase.rpc("get_package_registration_directory", { target_property_id: propertyId });
  const directory = (data ?? []) as AttentionDirectoryRow[];
  return <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 sm:px-10"><Link href={`/panel/propiedades/${propertyId}/llamados`} className="text-sm text-muted-foreground hover:text-foreground">← Llamados de {property.name}</Link><section className="mt-6 rounded-2xl border bg-card p-6 sm:p-8"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Nuevo expediente</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Crear llamado de atención</h1><p className="mt-2 mb-7 text-sm text-muted-foreground">Selecciona únicamente a las personas a quienes va dirigido. Otros ocupantes no tendrán acceso.</p><CreateAttentionCallForm propertyId={propertyId} directory={directory} /></section></main>;
}
