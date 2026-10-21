import Link from "next/link";
import { notFound } from "next/navigation";
import { CensusDetail } from "@/components/census/census-detail";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }

export default async function CensusRecordPage({ params }: { params: Promise<{ propertyId: string; recordId: string }> }) {
  const { propertyId, recordId } = await params;
  if (!uuidPattern.test(recordId)) notFound();
  const { supabase } = await requirePropertyAdmin(propertyId);
  const { data: record, error } = await supabase.from("census_records")
    .select("id,import_id,unit_id,full_name,email_normalized,cells,buildings(name),units(code)")
    .eq("property_id", propertyId).eq("id", recordId).maybeSingle();
  if (error || !record) notFound();
  const [{ data: source }, { data: neighbors }] = await Promise.all([
    supabase.from("census_imports").select("headers,file_name,created_at").eq("property_id", propertyId).eq("id", record.import_id).maybeSingle(),
    supabase.from("census_records").select("id,full_name,email_normalized").eq("property_id", propertyId).eq("unit_id", record.unit_id).order("source_row"),
  ]);
  if (!source || !Array.isArray(source.headers) || !Array.isArray(record.cells)) notFound();
  const headers = source.headers.map(String);
  const cells = record.cells.map((value) => value === null ? null : String(value));
  const building = one(record.buildings);
  const unit = one(record.units);
  return <main className="mx-auto min-w-0 max-w-4xl px-4 py-7 sm:px-8">
    <Link href={`/panel/propiedades/${propertyId}/censo`} className="text-sm text-primary hover:underline">← Volver al censo</Link>
    <header className="mt-5 border-b pb-5"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Censo de residentes</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{building?.name ?? "Torre"} · apartamento {unit?.code ?? "—"}</h1><p className="mt-2 text-sm text-muted-foreground">{record.full_name || record.email_normalized || "Respuesta sin nombre"}</p></header>
    {(neighbors ?? []).length > 1 && <nav className="mt-5 rounded-xl border p-4" aria-label="Respuestas del apartamento"><p className="mb-2 text-sm font-medium">Respuestas de este apartamento</p><div className="flex flex-wrap gap-2">{(neighbors ?? []).map((person) => <Link key={person.id} href={`/panel/propiedades/${propertyId}/censo/${person.id}`} aria-current={person.id === recordId ? "page" : undefined} className={`rounded-full border px-3 py-2 text-sm ${person.id === recordId ? "bg-secondary font-semibold" : "hover:bg-secondary"}`}>{person.full_name || person.email_normalized || "Sin nombre"}</Link>)}</div></nav>}
    <Card className="mt-6"><CardContent><CensusDetail headers={headers} cells={cells} /><p className="mt-6 border-t pt-4 text-xs text-muted-foreground">Origen: {source.file_name}. Importado el {new Date(source.created_at).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}. La autorización registrada corresponde únicamente al texto original del censo.</p></CardContent></Card>
  </main>;
}
