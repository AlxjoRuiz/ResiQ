import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { formatCop } from "@/lib/finance/constants";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { formatDay, formatMoment, newsLabels, uuidPattern, type LegalAccount, type LegalNews, type LegalProperty } from "../legal-data";
import { MarkPropertySeen } from "../mark-seen";

const tabs = [{ id: "mora", label: "En mora" }, { id: "aldia", label: "Al día" }, { id: "novedades", label: "Novedades" }, { id: "respuestas", label: "Respuestas" }] as const;
type Thread = { notice_id: string; property_id: string; unit_label: string; recipient_email: string; recipient_name: string | null; last_message: string; last_author: string; last_at: string; unread: number };
type Tab = (typeof tabs)[number]["id"];

// Cartera de un conjunto para la abogada (31/10/2026): En mora (desde el primer día de vencida cualquier deuda,
// con filtro escrito de días y de menos a más días), Al día (sin nada vencido), Novedades (lo que el administrador cargó, registró o anuló en los últimos 60 días)
// y, desde el 05/11/2026, Respuestas (se abre desde la barra izquierda): lo que contestaron los residentes de este conjunto. Solo lectura.
export default async function LegalPropertyPage({ params, searchParams }: { params: Promise<{ propertyId: string }>; searchParams: Promise<{ tab?: string; dias?: string; torre?: string; apto?: string }> }) {
  const [{ propertyId }, { tab: rawTab, dias: rawDays, torre: rawTower, apto: rawUnit }] = await Promise.all([params, searchParams]);
  // Filtro de torre y apartamento (13/11/2026, pedido de Alejandro), en En mora y Al día.
  const towerFilter = (rawTower ?? "").trim().slice(0, 80), unitFilter = (rawUnit ?? "").trim().slice(0, 30).toLowerCase();
  // Filtro de En mora: desde cuántos días de vencida la deuda más antigua sin pagar (la abogada lo escribe).
  const typedDays = Number(rawDays);
  const minDays = Number.isInteger(typedDays) && typedDays >= 1 && typedDays <= 3650 ? typedDays : 1;
  if (!uuidPattern.test(propertyId)) notFound();
  const tab: Tab = tabs.find((item) => item.id === rawTab)?.id ?? "mora";
  const { supabase } = await requireLegalStaff();
  const [{ data: propertyData, error: propertyError }, { data: accountData, error: accountError }, { data: newsData, error: newsError }, { data: threadData }] = await Promise.all([
    supabase.rpc("legal_list_properties"),
    // Todos los apartamentos, de 1.000 en 1.000 (Supabase corta en 1.000; 13/11/2026).
    fetchAllRows<LegalAccount>((from, to) => supabase.rpc("legal_property_accounts", { target_property_id: propertyId }).order("unit_id").range(from, to)),
    supabase.rpc("legal_property_news", { target_property_id: propertyId }),
    supabase.rpc("legal_list_threads"),
  ]);
  if (accountError?.message.includes("not_authorized") || newsError?.message.includes("not_authorized")) notFound();
  if (propertyError || accountError || newsError) throw new Error("No se pudo cargar la cartera del conjunto.");
  const property = ((propertyData ?? []) as LegalProperty[]).find((row) => row.property_id === propertyId);
  if (!property) notFound();
  const accounts = (accountData ?? []) as LegalAccount[];
  const news = (newsData ?? []) as LegalNews[];
  const arrears = accounts.filter((row) => row.in_arrears), current = accounts.filter((row) => !row.in_arrears);
  // Conversaciones de este conjunto; si la consulta falla, la pestaña sale vacía.
  const threads = ((threadData ?? []) as Thread[]).filter((row) => row.property_id === propertyId);
  const counts: Record<Tab, number> = { mora: arrears.length, aldia: current.length, novedades: news.filter((row) => row.is_new).length, respuestas: threads.filter((row) => row.last_author === "resident").length };
  // En mora de menos a más días (01/11/2026).
  const towers = [...new Set(accounts.map((row) => row.building_name))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const matches = (row: LegalAccount) => (!towerFilter || row.building_name === towerFilter) && (!unitFilter || row.unit_code.toLowerCase().includes(unitFilter));
  const rows = (tab === "mora" ? arrears.filter((row) => row.days_overdue >= minDays).sort((a, b) => a.days_overdue - b.days_overdue || Number(a.overdue) - Number(b.overdue))
    : current.slice().sort((a, b) => a.building_name.localeCompare(b.building_name, "es", { numeric: true }) || a.unit_code.localeCompare(b.unit_code, "es", { numeric: true }))).filter(matches);
  const tabTotal = tab === "mora" ? arrears.length : current.length;
  const filtering = minDays > 1 || Boolean(towerFilter) || Boolean(unitFilter);
  const fieldClass = "h-9 rounded-lg border bg-white px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

  return <PlatformPage eyebrow="Cobro jurídico" title={property.property_name} description={`${property.city ?? "Sin ciudad"} · en mora desde el primer día de vencida una deuda sin pagar`}
    back={<Link href="/juridica" className="text-sm text-muted-foreground hover:text-foreground">← Tus conjuntos</Link>}>
    <nav aria-label="Secciones de la cartera" className="flex flex-wrap gap-2">{tabs.filter((item) => item.id !== "respuestas").map((item) => <Link key={item.id} href={`/juridica/${propertyId}?tab=${item.id}`} aria-current={tab === item.id ? "page" : undefined}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition hover:scale-105 hover:shadow-sm motion-reduce:hover:scale-100 ${tab === item.id ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-secondary"}`}>{item.label}{counts[item.id] > 0 && <span className="ml-2 opacity-80">{counts[item.id]}</span>}</Link>)}</nav>

    {tab === "respuestas" ? <section aria-label="Respuestas" className="rounded-2xl border bg-white p-5">
      {threads.length ? <ul className="grid gap-3">{threads.map((thread) => <li key={thread.notice_id}><Link href={`/juridica/respuestas/${thread.notice_id}`} className={`block rounded-xl border p-4 transition-colors hover:bg-secondary ${thread.last_author === "resident" ? "border-primary/40 bg-primary/5" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-semibold">{thread.last_author === "resident" && <span aria-hidden="true" className="size-2.5 rounded-full bg-red-500" />}{thread.unit_label}</p><p className="break-all text-sm text-muted-foreground">{thread.recipient_name ? `${thread.recipient_name} · ` : ""}{thread.recipient_email}</p></div>
          <span className="shrink-0 text-xs text-muted-foreground">{formatMoment.format(new Date(thread.last_at))}</span></div>
        <p className="mt-2 line-clamp-2 text-sm"><span className="text-muted-foreground">{thread.last_author === "lawyer" ? "Tú: " : ""}</span>{thread.last_message}</p>
        {thread.last_author === "resident" && <p className="mt-1 text-xs font-medium text-red-700">Por responder</p>}
      </Link></li>)}</ul> : <p className="text-sm text-muted-foreground">Todavía no hay respuestas de este conjunto. Cuando un residente responda un requerimiento desde su correo, aparece aquí.</p>}
    </section> : tab === "novedades" ? <section aria-label="Novedades" className="rounded-2xl border bg-white p-5">
      <MarkPropertySeen propertyId={propertyId} />
      <p className="text-sm text-muted-foreground">{property.seen_at ? `Lo resaltado es nuevo desde tu última visita (${formatMoment.format(new Date(property.seen_at))}).` : "Primera visita: todo lo de los últimos 60 días sale como nuevo."}</p>
      {news.length ? <ul className="mt-4 grid gap-2">{news.map((item, index) => { const voided = item.kind.endsWith("voided") || item.kind === "agreement_cancelled"; return <li key={`${item.occurred_at}-${index}`} className={`grid gap-1 rounded-xl border p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start ${voided ? "border-red-300 bg-red-50" : item.kind === "payment" || item.is_new ? "border-primary/40 bg-primary/5" : ""}`}>
        <div className="min-w-0"><p className={`font-medium ${voided ? "text-red-800" : ""}`}>{newsLabels[item.kind] ?? item.kind} · <Link href={`/juridica/${propertyId}/${item.unit_id}`} className="hover:underline">{item.unit_label}</Link></p>{item.description && (item.kind === "agreement_cancelled"
          ? <p className="break-words text-red-900"><span className="font-semibold">Motivo:</span> {item.description}</p>
          : <p className="break-words text-muted-foreground">{item.description}</p>)}<p className="text-xs text-muted-foreground">{formatMoment.format(new Date(item.occurred_at))}</p></div>
        <span className={`font-semibold ${voided ? "text-red-700 line-through" : ""}`}>{formatCop(item.amount)}</span>
      </li>; })}</ul> : <p className="mt-4 text-sm text-muted-foreground">Sin movimientos de cartera en los últimos 60 días.</p>}
    </section> : <section aria-label={tab === "mora" ? "Apartamentos en mora" : "Apartamentos al día"} className="rounded-2xl border bg-white p-5">
      {tabTotal > 0 && <form action={`/juridica/${propertyId}`} aria-label="Filtrar apartamentos" className="mb-4 flex flex-wrap items-center gap-2 text-sm"><input type="hidden" name="tab" value={tab} />
        <label className="flex items-center gap-2 text-muted-foreground">Torre<select name="torre" defaultValue={towerFilter} className={`${fieldClass} min-w-32`}><option value="">Todas</option>{towers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label className="flex items-center gap-2 text-muted-foreground">Apartamento<input name="apto" defaultValue={rawUnit ?? ""} maxLength={30} placeholder="Ej.: 402" className={`${fieldClass} w-24`} /></label>
        {tab === "mora" && <label className="flex items-center gap-2 text-muted-foreground">Desde<input name="dias" type="number" min={1} max={3650} step={1} defaultValue={minDays > 1 ? minDays : ""} placeholder="1" className={`${fieldClass} w-20`} />días en mora</label>}
        <button className="h-9 rounded-lg border bg-white px-3 text-sm font-medium hover:bg-secondary">Ver</button>
        {filtering && <Link href={`/juridica/${propertyId}?tab=${tab}`} className="flex h-9 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">Borrar filtros</Link>}
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} de {tabTotal}</span></form>}
      {rows.length ? <ul className="grid gap-2">{rows.map((row) => <li key={row.unit_id}><Link href={`/juridica/${propertyId}/${row.unit_id}`} className="grid gap-2 rounded-xl border p-3 text-sm transition-colors hover:bg-secondary sm:grid-cols-[1fr_auto] sm:items-center">
        <span className="min-w-0"><span className="flex flex-wrap items-center gap-2 font-medium">{row.building_name} · {row.unit_code}{row.agreement_active && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">Acuerdo de pago</span>}</span>
          <span className="block truncate text-muted-foreground">{row.owner_name ?? "Sin nombre en el censo"}</span>
          <span className="block text-xs text-muted-foreground">Último pago: {formatDay(row.last_payment_on)}</span></span>
        <span className="sm:text-right"><span className={`block font-semibold ${row.in_arrears ? "text-urgent" : ""}`}>{formatCop(row.in_arrears ? row.overdue : row.outstanding)}</span>
          <span className="block text-xs text-muted-foreground">{row.days_overdue > 0 ? `${row.days_overdue} días de mora` : row.outstanding > 0 ? "Saldo sin vencer" : "Sin saldo"}</span></span>
      </Link></li>)}</ul> : <p className="text-sm text-muted-foreground">{filtering && tabTotal > 0 ? "Ningún apartamento coincide con los filtros." : tab === "mora" ? "Ningún apartamento está en mora." : "No hay apartamentos al día."}</p>}
    </section>}
  </PlatformPage>;
}
