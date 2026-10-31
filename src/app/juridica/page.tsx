import Link from "next/link";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { formatCop } from "@/lib/finance/constants";
import type { LegalProperty } from "./legal-data";

// Inicio de la abogada (31/10/2026): los conjuntos que le asignó el superadmin, con la cartera en mora
// según el umbral de cada uno y las novedades desde su última visita.
export default async function LegalHomePage() {
  const { supabase } = await requireLegalStaff();
  const { data, error } = await supabase.rpc("legal_list_properties");
  if (error) throw new Error("No se pudieron cargar tus conjuntos.");
  const properties = (data ?? []) as LegalProperty[];
  return <PlatformPage eyebrow="Cobro jurídico" title="Tus conjuntos" description="Cartera en vivo, en solo lectura, de los conjuntos que ResiQ te asignó.">
    {properties.length ? <ul className="grid gap-4 md:grid-cols-2">{properties.map((property) => <li key={property.property_id}><Link href={`/juridica/${property.property_id}`} className="block rounded-2xl border bg-white p-5 transition-colors hover:border-primary/40 hover:bg-secondary/40">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold">{property.property_name}</h2><p className="text-sm text-muted-foreground">{property.city ?? "Sin ciudad"} · mora desde {property.overdue_days} días</p></div>
        {property.news_count > 0 && <span className="shrink-0 rounded-full bg-primary/12 px-3 py-1 text-xs font-medium text-primary">{property.news_count} novedades</span>}</div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div><dt className="text-muted-foreground">En mora</dt><dd className="text-xl font-semibold text-red-700">{property.units_in_arrears}</dd></div>
        <div><dt className="text-muted-foreground">Al día</dt><dd className="text-xl font-semibold">{property.units_current}</dd></div>
        <div><dt className="text-muted-foreground">Deuda en mora</dt><dd className="font-semibold">{formatCop(property.arrears_amount)}</dd></div>
      </dl>
    </Link></li>)}</ul> : <p className="rounded-2xl border bg-white p-5 text-sm text-muted-foreground">Todavía no tienes conjuntos asignados. Cuando ResiQ te asigne uno, aparecerá aquí.</p>}
  </PlatformPage>;
}
