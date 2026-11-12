import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import liftCard from "@/components/ui/lift-card.module.css";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { formatCop } from "@/lib/finance/constants";
import { greetingWithName } from "@/lib/time-zone";
import type { LegalProperty } from "./legal-data";

// Inicio de la abogada (31/10/2026): los conjuntos que le asignó el superadmin, con la cartera en mora
// (desde el primer día de vencida una deuda) y las novedades desde su última visita.
// Tarjetas blancas que se levantan al pasar el cursor, como las de la portada (11/11/2026).
export default async function LegalHomePage() {
  const { supabase, userId } = await requireLegalStaff();
  const [{ data, error }, { data: threadData }, { data: profile }] = await Promise.all([supabase.rpc("legal_list_properties"), supabase.rpc("legal_list_threads"),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle()]);
  // Respuestas por contestar por conjunto (05/11/2026), en su tarjeta: el último mensaje es del residente.
  const unread = new Map<string, number>();
  for (const row of (threadData ?? []) as { property_id: string; last_author: string }[]) if (row.last_author === "resident") unread.set(row.property_id, (unread.get(row.property_id) ?? 0) + 1);
  if (error) throw new Error("No se pudieron cargar tus conjuntos.");
  const properties = (data ?? []) as LegalProperty[];
  // Saludo según la hora (10/11/2026), igual que en el inicio del conjunto.
  return <PlatformPage eyebrow="Cobro jurídico" title={greetingWithName(profile?.display_name)} description="Tus conjuntos: cartera en vivo, en solo lectura, de los conjuntos que ResiQ te asignó.">
    {properties.length ? <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{properties.map((property) => <li key={property.property_id}><Link href={`/juridica/${property.property_id}`} className="block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
      {/* Mismo aspecto y efecto que las tarjetas de módulos de la portada (11/11/2026). */}
      <div className={`${liftCard.card} flex h-full flex-col rounded-2xl p-6`}>
        <div className="flex items-start justify-between gap-3">
          <span className={`${liftCard.icon} size-12 shrink-0`}><Building2 size={22} aria-hidden="true" /></span>
          {property.news_count > 0 || unread.get(property.property_id) ? <span className="flex flex-wrap justify-end gap-1">{property.news_count > 0 && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">{property.news_count} {property.news_count === 1 ? "novedad" : "novedades"}</span>}{(unread.get(property.property_id) ?? 0) > 0 && <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-[11px] font-medium text-white">{unread.get(property.property_id)} por responder</span>}</span> : <ArrowRight size={18} aria-hidden="true" className="mt-1 text-muted-foreground" />}
        </div>
        <h2 className="mt-5 text-lg font-semibold">{property.property_name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{property.city ?? "Sin ciudad"}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-secondary/60 px-2.5 py-2"><dt className="text-[11px] text-muted-foreground">Más de 60 días</dt><dd className="text-base font-semibold text-urgent">{property.units_in_arrears}</dd></div>
          <div className="rounded-xl bg-secondary/60 px-2.5 py-2"><dt className="text-[11px] text-muted-foreground">Deuda en mora</dt><dd className="break-words text-xs font-semibold leading-6">{formatCop(property.arrears_amount)}</dd></div>
        </dl>
      </div>
    </Link></li>)}</ul> : <p className="rounded-2xl border bg-white p-5 text-sm text-muted-foreground">Todavía no tienes conjuntos asignados. Cuando ResiQ te asigne uno, aparecerá aquí.</p>}
  </PlatformPage>;
}
