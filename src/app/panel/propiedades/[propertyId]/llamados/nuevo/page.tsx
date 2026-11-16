import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { CreateAttentionCallForm, type AttentionDirectoryRow } from "@/components/attention-calls/attention-call-forms";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

export default async function NewAttentionCallPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase } = await requirePropertyAdmin(propertyId);
  const { data } = await fetchAllRows((from, to) => supabase.rpc("get_package_registration_directory", { target_property_id: propertyId }).order("unit_id").order("member_id").range(from, to));
  const directory = (data ?? []) as AttentionDirectoryRow[];
  return <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 sm:px-10"><Link href={`/panel/propiedades/${propertyId}/llamados`} className="text-sm text-muted-foreground hover:text-foreground">← Volver a Llamados</Link><section className="mt-6 rounded-2xl border border-primary/30 bg-card p-6 sm:p-8"><div className="flex items-start gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><TriangleAlert size={22} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Nuevo expediente</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-primary">Crear llamado de atención</h1></div></div><p className="mt-2 mb-7 text-sm text-muted-foreground">Selecciona únicamente a las personas a quienes va dirigido. Otros ocupantes no tendrán acceso.</p><CreateAttentionCallForm propertyId={propertyId} directory={directory} /></section></main>;
}
