import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { formatCop } from "@/lib/finance/constants";
import { formatDay, formatMoment, newsLabels, uuidPattern, type LegalAccount, type LegalNews, type LegalProperty } from "../legal-data";
import { MarkPropertySeen } from "../mark-seen";

const tabs = [{ id: "mora", label: "En mora" }, { id: "aldia", label: "Al día" }, { id: "novedades", label: "Novedades" }] as const;
type Tab = (typeof tabs)[number]["id"];

// Cartera de un conjunto para la abogada (31/10/2026): En mora (supera el umbral del conjunto), Al día (el
// resto) y Novedades (lo que el administrador cargó, registró o anuló en los últimos 60 días). Solo lectura.
export default async function LegalPropertyPage({ params, searchParams }: { params: Promise<{ propertyId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ propertyId }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  if (!uuidPattern.test(propertyId)) notFound();
  const tab: Tab = tabs.find((item) => item.id === rawTab)?.id ?? "mora";
  const { supabase } = await requireLegalStaff();
  const [{ data: propertyData, error: propertyError }, { data: accountData, error: accountError }, { data: newsData, error: newsError }] = await Promise.all([
    supabase.rpc("legal_list_properties"),
    supabase.rpc("legal_property_accounts", { target_property_id: propertyId }),
    supabase.rpc("legal_property_news", { target_property_id: propertyId }),
  ]);
  if (accountError?.message.includes("not_authorized") || newsError?.message.includes("not_authorized")) notFound();
  if (propertyError || accountError || newsError) throw new Error("No se pudo cargar la cartera del conjunto.");
  const property = ((propertyData ?? []) as LegalProperty[]).find((row) => row.property_id === propertyId);
  if (!property) notFound();
  const accounts = (accountData ?? []) as LegalAccount[];
  const news = (newsData ?? []) as LegalNews[];
  const arrears = accounts.filter((row) => row.in_arrears), current = accounts.filter((row) => !row.in_arrears);
  const counts: Record<Tab, number> = { mora: arrears.length, aldia: current.length, novedades: news.filter((row) => row.is_new).length };
  const rows = tab === "mora" ? arrears : current;

  return <PlatformPage eyebrow="Cobro jurídico" title={property.property_name} description={`${property.city ?? "Sin ciudad"} · en mora desde ${property.overdue_days} días de vencida la deuda más antigua sin pagar`}
    back={<Link href="/juridica" className="text-sm text-muted-foreground hover:text-foreground">← Tus conjuntos</Link>}>
    <nav aria-label="Secciones de la cartera" className="flex flex-wrap gap-2">{tabs.map((item) => <Link key={item.id} href={`/juridica/${propertyId}?tab=${item.id}`} aria-current={tab === item.id ? "page" : undefined}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${tab === item.id ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-secondary"}`}>{item.label}{counts[item.id] > 0 && <span className="ml-2 opacity-80">{counts[item.id]}</span>}</Link>)}</nav>

    {tab === "novedades" ? <section aria-label="Novedades" className="rounded-2xl border bg-white p-5">
      <MarkPropertySeen propertyId={propertyId} />
      <p className="text-sm text-muted-foreground">{property.seen_at ? `Lo resaltado es nuevo desde tu última visita (${formatMoment.format(new Date(property.seen_at))}).` : "Primera visita: todo lo de los últimos 60 días sale como nuevo."}</p>
      {news.length ? <ul className="mt-4 grid gap-2">{news.map((item, index) => <li key={`${item.occurred_at}-${index}`} className={`grid gap-1 rounded-xl border p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start ${item.is_new ? "border-primary/40 bg-primary/5" : ""}`}>
        <div className="min-w-0"><p className="font-medium">{newsLabels[item.kind] ?? item.kind} · <Link href={`/juridica/${propertyId}/${item.unit_id}`} className="hover:underline">{item.unit_label}</Link></p>{item.description && <p className="break-words text-muted-foreground">{item.description}</p>}<p className="text-xs text-muted-foreground">{formatMoment.format(new Date(item.occurred_at))}</p></div>
        <span className={`font-semibold ${item.kind.endsWith("voided") || item.kind === "agreement_cancelled" ? "text-muted-foreground line-through" : ""}`}>{formatCop(item.amount)}</span>
      </li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">Sin movimientos de cartera en los últimos 60 días.</p>}
    </section> : <section aria-label={tab === "mora" ? "Apartamentos en mora" : "Apartamentos al día"} className="rounded-2xl border bg-white p-5">
      {rows.length ? <ul className="grid gap-2">{rows.map((row) => <li key={row.unit_id}><Link href={`/juridica/${propertyId}/${row.unit_id}`} className="grid gap-2 rounded-xl border p-3 text-sm transition-colors hover:bg-secondary sm:grid-cols-[1fr_auto] sm:items-center">
        <span className="min-w-0"><span className="flex flex-wrap items-center gap-2 font-medium">{row.building_name} · {row.unit_code}{row.agreement_active && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">Acuerdo de pago</span>}</span>
          <span className="block truncate text-muted-foreground">{row.owner_name ?? "Sin nombre en el censo"}</span>
          <span className="block text-xs text-muted-foreground">Último pago: {formatDay(row.last_payment_on)}</span></span>
        <span className="sm:text-right"><span className={`block font-semibold ${row.in_arrears ? "text-red-700" : ""}`}>{formatCop(row.in_arrears ? row.overdue : row.outstanding)}</span>
          <span className="block text-xs text-muted-foreground">{row.days_overdue > 0 ? `${row.days_overdue} días de mora` : row.outstanding > 0 ? "Saldo sin vencer" : "Sin saldo"}</span></span>
      </Link></li>)}</ul> : <p className="text-sm text-muted-foreground">{tab === "mora" ? "Ningún apartamento supera el umbral de mora." : "No hay apartamentos al día."}</p>}
    </section>}
  </PlatformPage>;
}
