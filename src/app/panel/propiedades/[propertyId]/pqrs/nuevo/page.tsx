import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatePqrsForm } from "@/components/pqrs/pqrs-forms";
import { requirePropertyMember } from "@/lib/auth/require-property-member";

type UnitLink = { unit_id: string; units: { code: string; buildings: { name: string } | { name: string }[] | null } | { code: string; buildings: { name: string } | { name: string }[] | null }[] | null };
export default async function NewPqrsPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase, membership } = await requirePropertyMember(propertyId);
  if (!membership.roles.includes("member")) notFound();
  const { data } = await supabase.from("unit_memberships").select("unit_id,units(code,buildings(name))").eq("property_id", propertyId).eq("member_id", membership.id).lte("valid_from", new Date().toISOString()).or(`valid_to.is.null,valid_to.gt.${new Date().toISOString()}`);
  const units = ((data ?? []) as UnitLink[]).map((link) => { const unit = Array.isArray(link.units) ? link.units[0] : link.units; const building = Array.isArray(unit?.buildings) ? unit.buildings[0] : unit?.buildings; return { id: link.unit_id, label: [building?.name, unit?.code].filter(Boolean).join(" · ") || "Apartamento" }; });
  return <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 sm:px-10"><Link href={`/panel/propiedades/${propertyId}/pqrs`} className="text-sm text-muted-foreground hover:text-foreground">← Volver a PQRS</Link><section className="mt-6 rounded-2xl border bg-card p-6 sm:p-8"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Nueva solicitud</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Crear PQRS</h1><p className="mt-2 mb-7 text-sm text-muted-foreground">La administración de tu propiedad podrá verla y responderla.</p>{units.length ? <CreatePqrsForm propertyId={propertyId} units={units} /> : <p className="rounded-xl bg-secondary p-4 text-sm">Necesitas un apartamento activo vinculado para crear una PQRS.</p>}</section></main>;
}
