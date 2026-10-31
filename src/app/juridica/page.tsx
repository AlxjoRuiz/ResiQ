import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import styles from "@/components/dashboard/dashboard.module.css";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { formatCop } from "@/lib/finance/constants";
import type { LegalProperty } from "./legal-data";

// Inicio de la abogada (31/10/2026): los conjuntos que le asignó el superadmin, con la cartera en mora
// según los días de mora que define el admin de cada uno en Cartera y las novedades desde su última visita.
// Tarjetas con el vidrio azul del login (el mismo de las tarjetas del superadmin).
export default async function LegalHomePage() {
  const { supabase } = await requireLegalStaff();
  const { data, error } = await supabase.rpc("legal_list_properties");
  if (error) throw new Error("No se pudieron cargar tus conjuntos.");
  const properties = (data ?? []) as LegalProperty[];
  return <PlatformPage eyebrow="Cobro jurídico" title="Tus conjuntos" description="Cartera en vivo, en solo lectura, de los conjuntos que ResiQ te asignó.">
    {properties.length ? <ul className="grid gap-5 md:grid-cols-2">{properties.map((property) => <li key={property.property_id}><Link href={`/juridica/${property.property_id}`} className="block h-full rounded-[22px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
      <div className={`${styles.glassCard} flex h-full flex-col rounded-[22px] p-6`}>
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/70 text-[#2f4f8a] shadow-sm"><Building2 size={21} aria-hidden="true" /></span>
          {property.news_count > 0 ? <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-primary shadow-sm">{property.news_count} {property.news_count === 1 ? "novedad" : "novedades"}</span> : <ArrowRight size={18} aria-hidden="true" className="mt-1 text-[#2f4f8a]/60" />}
        </div>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">{property.property_name}</h2>
        <p className="text-sm text-[#3d5a8a]">{property.city ?? "Sin ciudad"} · mora desde {property.overdue_days} días</p>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-2xl border border-white/80 bg-white/60 p-3"><dt className="text-xs text-muted-foreground">En mora</dt><dd className="mt-1 text-2xl font-semibold text-red-700">{property.units_in_arrears}</dd></div>
          <div className="rounded-2xl border border-white/80 bg-white/60 p-3"><dt className="text-xs text-muted-foreground">Al día</dt><dd className="mt-1 text-2xl font-semibold">{property.units_current}</dd></div>
          <div className="rounded-2xl border border-white/80 bg-white/60 p-3"><dt className="text-xs text-muted-foreground">Deuda en mora</dt><dd className="mt-1 break-words font-semibold">{formatCop(property.arrears_amount)}</dd></div>
        </dl>
      </div>
    </Link></li>)}</ul> : <p className="rounded-2xl border bg-white p-5 text-sm text-muted-foreground">Todavía no tienes conjuntos asignados. Cuando ResiQ te asigne uno, aparecerá aquí.</p>}
  </PlatformPage>;
}
