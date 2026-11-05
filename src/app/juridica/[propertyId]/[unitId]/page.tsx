import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { CollectionNoticeForm } from "@/components/legal/collection-notice-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { formatCop } from "@/lib/finance/constants";
import { installmentStateLabels, parseSchedule, type InstallmentState } from "@/lib/finance/agreement-schedule";
import { deliveryLabels, formatDay, formatMoment, uuidPattern } from "../../legal-data";

type Detail = {
  unit: { building: string; code: string; floor: string | null }; property: string; overdue_days: number; today: string; signer: string | null;
  contacts: { name: string | null; type: string | null; email: string | null; phone: string | null; primary: boolean }[];
  receivables: { id: string; concept: string; amount: number; outstanding: number; issued_on: string; due_on: string; status: string; source: string; void_reason?: string | null; voided_at?: string | null; voided_by_name?: string | null }[];
  // Historial de pagos (04/11/2026): lo pagado, el comprobante, la anulación y si fue corregido.
  // Quién pagó y quién anuló (05/11/2026).
  payments: { id?: string; amount: number; paid_on: string; reference: string | null; status: string; recorded_at?: string; voided_at?: string | null; void_reason?: string | null; concepts?: string | null; evidence_id?: string | null; evidence_name?: string | null; payer_name?: string | null; recorded_by_name?: string | null; voided_by_name?: string | null; corrected_on?: string | null; corrects?: boolean }[];
  agreements: { total: number; status: string; notes: string | null; created_at: string; cancel_reason?: string | null; cancelled_at?: string | null; cancelled_by_name?: string | null; schedule?: unknown; installments: { amount: number; due_on: string }[] }[];
};
// Encabezado de tabla con el azul de ResiQ y bordes redondeados (05/11/2026).
const tableHead = "bg-primary text-left text-primary-foreground";
// Mismo ancho de columnas en todas las tablas del cuadro (Concepto/Cuota, Vence, Valor, Pendiente/Estado).
const tableClass = "w-full min-w-[560px] table-fixed text-sm";
const columns = <colgroup><col /><col className="w-32" /><col className="w-36" /><col className="w-32" /></colgroup>;
type Notice = { notice_id: string; created_at: string; recipient_email: string; recipient_name: string | null; subject: string; total: number; debt_count: number; delivery_status: string; replies?: number };
const tabs = [{ id: "requerimiento", label: "Requerimiento de pago" }, { id: "cartera", label: "Cartera" }] as const;
type Tab = (typeof tabs)[number]["id"];

// Detalle de un apartamento para la abogada (31/10/2026), en solo lectura (cada consulta queda en auditoría).
// En pestañas (04/11/2026): arriba siempre el saldo; «Requerimiento de pago» (cobros vencidos y próximos a
// vencer, el formulario, los enviados y los contactos) y «Cartera» (todos los cobros, pagos y acuerdos).
export default async function LegalUnitPage({ params, searchParams }: { params: Promise<{ propertyId: string; unitId: string }>; searchParams: Promise<{ seccion?: string }> }) {
  const [{ propertyId, unitId }, { seccion }] = await Promise.all([params, searchParams]);
  const tab: Tab = tabs.find((item) => item.id === seccion)?.id ?? "requerimiento";
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(unitId)) notFound();
  const { supabase } = await requireLegalStaff();
  const [{ data, error }, { data: recipientData, error: recipientError }, { data: noticeData, error: noticeError }] = await Promise.all([
    supabase.rpc("legal_unit_detail", { target_property_id: propertyId, target_unit_id: unitId }),
    supabase.rpc("legal_unit_recipients", { target_property_id: propertyId, target_unit_id: unitId }),
    supabase.rpc("legal_unit_notices", { target_property_id: propertyId, target_unit_id: unitId }),
  ]);
  if (error?.message.includes("not_authorized") || error?.message.includes("unit_not_found")) notFound();
  if (error || !data) throw new Error("No se pudo cargar el apartamento.");
  const detail = data as Detail;
  const active = detail.receivables.filter((row) => row.status === "active");
  const outstanding = active.reduce((sum, row) => sum + Number(row.outstanding), 0);
  const late = active.filter((row) => Number(row.outstanding) > 0 && row.due_on < detail.today);
  const overdue = late.reduce((sum, row) => sum + Number(row.outstanding), 0);
  const oldest = late.map((row) => row.due_on).sort()[0];
  // Requerimiento de pago (31/10/2026): si sus funciones aún no están en la base de datos, la sección lo dice y el resto se ve igual.
  const noticesReady = !recipientError && !noticeError;
  const recipients = (recipientData ?? []) as { email: string; name: string | null; kind: string }[];
  const notices = (noticeData ?? []) as Notice[];
  const debts = active.filter((row) => Number(row.outstanding) > 0).sort((a, b) => a.due_on.localeCompare(b.due_on)).map((row) => ({ id: row.id, concept: row.concept, due_on: row.due_on, outstanding: Number(row.outstanding), overdue: row.due_on < detail.today }));
  const days = oldest ? Math.round((Date.parse(`${detail.today}T12:00:00Z`) - Date.parse(`${oldest}T12:00:00Z`)) / 86400000) : 0;
  const counts: Record<Tab, number> = { requerimiento: debts.length, cartera: detail.receivables.filter((row) => row.status === "active").length };
  // Días que faltan o que lleva vencida cada deuda con saldo.
  const dayDiff = (due: string) => Math.round((Date.parse(`${due}T12:00:00Z`) - Date.parse(`${detail.today}T12:00:00Z`)) / 86400000);
  const base = `/juridica/${propertyId}/${unitId}`;
  // Cobros en orden: vencidos, por vencer, pagados y anulados (04/11/2026).
  const receivableRank = (row: Detail["receivables"][number]) => row.status === "void" ? 3 : Number(row.outstanding) <= 0 ? 2 : row.due_on < detail.today ? 0 : 1;
  const sortedReceivables = [...detail.receivables].sort((a, b) => receivableRank(a) - receivableRank(b) || (receivableRank(a) >= 2 ? b.due_on.localeCompare(a.due_on) : a.due_on.localeCompare(b.due_on)));
  // Acuerdos de pago (05/11/2026): solo el vigente (los cancelados y los ya pagados no se muestran). El calendario es el
  // mismo cálculo de la base de datos que ven el admin y el residente: lo que falta es lo que falta de sus deudas.
  // Deudas del acuerdo vigente (05/11/2026): una deuda con saldo que no está en él sale «No está en el acuerdo de pago».
  const activeAgreement = detail.agreements.find((agreement) => agreement.status === "active");
  const agreementDebtIds = activeAgreement ? new Set(parseSchedule(activeAgreement.schedule)?.debt_ids ?? []) : null;
  const agreements = detail.agreements.filter((agreement) => agreement.status === "active").map((agreement) => {
    const schedule = parseSchedule(agreement.schedule);
    const installments = schedule ? schedule.installments.map((item) => ({ amount: item.amount, due: item.due_amount, due_on: item.due_on, state: item.state as InstallmentState | null }))
      : agreement.installments.map((item) => ({ amount: Number(item.amount), due: Number(item.amount), due_on: item.due_on, state: null as InstallmentState | null }));
    return { ...agreement, installments, remaining: schedule?.remaining ?? null, paid: agreement.status === "completed" || (schedule ? schedule.remaining <= 0 : false) };
  });

  // Historial de pagos (05/11/2026): se ven los 4 más recientes; el resto en «Ver más».
  const postedPayments = detail.payments.filter((row) => row.status !== "void");
  const paymentItem = (row: Detail["payments"][number], index: number) => { const voided = row.status === "void"; const byResident = Boolean(row.evidence_id && row.payer_name); return <li key={row.id ?? index} className={`grid gap-1.5 rounded-xl border p-3 text-sm ${voided ? "border-red-300 bg-red-50" : "border-primary/40 bg-primary/5"}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className={`font-medium ${voided ? "text-red-800" : ""}`}>Pagado el {formatDay(row.paid_on)}{voided && " · anulado"}</p>
          <span className={`font-semibold ${voided ? "text-red-700 line-through" : ""}`}>{formatCop(row.amount)}</span>
        </div>
        {/* Quién pagó (05/11/2026): el residente que envió el comprobante o la administración que lo registró. */}
        <p className="text-xs"><span className={`rounded-full px-2 py-0.5 font-medium ${byResident ? "bg-primary/12 text-primary" : "bg-secondary"}`}>{byResident ? `Pagado por el residente · ${row.payer_name}` : `Registrado por la administración${row.recorded_by_name ? ` · ${row.recorded_by_name}` : ""}`}</span></p>
        <p className="text-muted-foreground">{row.concepts ?? (row.reference && !row.reference.startsWith("Comprobante:") ? row.reference : "Sin aplicar a una deuda")}</p>
        <p className="flex flex-wrap items-center gap-2 text-xs">{row.evidence_id ? <a href={`/api/legal/evidence/${row.evidence_id}`} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Ver comprobante{row.evidence_name ? ` · ${row.evidence_name}` : ""}</a> : <span className="text-muted-foreground">Sin comprobante</span>}
          {row.corrects && <span className="rounded-full bg-primary/12 px-2 py-0.5 font-medium text-primary">Corrige un pago anulado</span>}</p>
        {/* Anulación más visible: quién la hizo (la administración), cuándo y el motivo destacado. */}
        {voided && <div className="rounded-lg border border-red-300 bg-white p-3">
          <p className="text-xs font-semibold text-red-800">Anulado por la administración{row.voided_by_name ? ` · ${row.voided_by_name}` : ""}{row.voided_at ? ` · ${formatMoment.format(new Date(row.voided_at))}` : ""}</p>
          {row.void_reason && <p className="mt-1 text-sm text-red-900"><span className="font-semibold">Motivo:</span> {row.void_reason}</p>}
        </div>}
        {voided && row.corrected_on && <p><span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">Corregido · pagado de nuevo el {formatDay(row.corrected_on)}</span></p>}
      </li>; };
  // Anulaciones y cancelaciones (05/11/2026): obligaciones anuladas (administración, multas, otras deudas), acuerdos
  // cancelados y pagos anulados, con el motivo, la fecha y quién lo hizo. De la más reciente a la más antigua.
  const voids = [
    ...detail.receivables.filter((row) => row.status === "void").map((row) => ({ key: `r-${row.id}`, title: "Obligación anulada", detail: row.concept, amount: Number(row.amount), at: row.voided_at ?? null, by: row.voided_by_name ?? null, reason: row.void_reason ?? null, verb: "Anulada", note: null as string | null })),
    ...detail.payments.filter((row) => row.status === "void").map((row, index) => ({ key: `p-${row.id ?? index}`, title: "Pago anulado", detail: `Pagado el ${formatDay(row.paid_on)}${row.concepts ? ` · ${row.concepts}` : ""}`, amount: Number(row.amount), at: row.voided_at ?? null, by: row.voided_by_name ?? null, reason: row.void_reason ?? null, verb: "Anulado", note: row.corrected_on ? `Corregido · pagado de nuevo el ${formatDay(row.corrected_on)}` : null })),
    ...detail.agreements.filter((row) => row.status === "cancelled").map((row, index) => ({ key: `a-${index}`, title: "Acuerdo de pago cancelado", detail: `${row.installments.length} ${row.installments.length === 1 ? "cuota" : "cuotas"} · creado el ${formatMoment.format(new Date(row.created_at))}`, amount: Number(row.total), at: row.cancelled_at ?? null, by: row.cancelled_by_name ?? null, reason: row.cancel_reason ?? null, verb: "Cancelado", note: null as string | null })),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return <PlatformPage eyebrow={detail.property} title={`${detail.unit.building} · ${detail.unit.code}`} description="Cartera en solo lectura. Los cambios los hace la administración del conjunto."
    back={<Link href={`/juridica/${propertyId}`} className="text-sm text-muted-foreground hover:text-foreground">← Cartera del conjunto</Link>}
    actions={<span className="flex flex-wrap gap-2">{oldest ? <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">En mora · {days} días</span> : <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Al día</span>}</span>}>
    <section aria-label="Saldo" className="grid gap-4 sm:grid-cols-3">
      <Card><CardContent><p className="text-2xl font-semibold">{formatCop(outstanding)}</p><p className="mt-1 text-sm text-muted-foreground">Saldo pendiente</p></CardContent></Card>
      <Card><CardContent><p className="text-2xl font-semibold text-red-700">{formatCop(overdue)}</p><p className="mt-1 text-sm text-muted-foreground">Vencido</p></CardContent></Card>
      <Card><CardContent><p className="text-2xl font-semibold">{days}</p><p className="mt-1 text-sm text-muted-foreground">Días desde la deuda más antigua sin pagar</p></CardContent></Card>
    </section>

    <nav aria-label="Secciones del apartamento" className="flex flex-wrap gap-2">{tabs.map((item) => <Link key={item.id} href={item.id === "requerimiento" ? base : `${base}?seccion=${item.id}`} aria-current={tab === item.id ? "page" : undefined}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition hover:scale-105 hover:shadow-sm motion-reduce:hover:scale-100 ${tab === item.id ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-secondary"}`}>{item.label}{counts[item.id] > 0 && <span className="ml-2 opacity-80">{counts[item.id]}</span>}</Link>)}</nav>

    {tab === "requerimiento" && <>
    <Card><CardContent><h2 className="text-lg font-semibold">Cobros vencidos y próximos a vencer</h2>
      {debts.length ? <ul className="mt-3 grid gap-2">{debts.map((debt) => { const diff = dayDiff(debt.due_on); return <li key={debt.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm ${debt.overdue ? "border-red-300 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
        <span className="min-w-0"><span className="block font-medium">{debt.concept}</span><span className={`block text-xs ${debt.overdue ? "text-red-700" : "text-amber-900"}`}>{debt.overdue ? `Vencida hace ${-diff} ${-diff === 1 ? "día" : "días"}` : diff === 0 ? "Vence hoy" : `Vence en ${diff} ${diff === 1 ? "día" : "días"}`} · {formatDay(debt.due_on)}</span></span>
        <span className={`font-semibold ${debt.overdue ? "text-red-700" : ""}`}>{formatCop(debt.outstanding)}</span>
      </li>; })}</ul> : <p className="mt-2 text-sm text-muted-foreground">Este apartamento no tiene deudas con saldo.</p>}
    </CardContent></Card>

    <Card><CardContent>
      <h2 className="text-lg font-semibold">Requerimiento de pago</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">Elige las deudas que vas a cobrar y escribe el mensaje. Le llega al correo del apartamento con el detalle de las deudas y tu firma.</p>
      {noticesReady ? <CollectionNoticeForm propertyId={propertyId} unitId={unitId} unitLabel={`${detail.unit.building} · ${detail.unit.code}`} propertyName={detail.property} debts={debts} recipients={recipients} />
        : <p className="text-sm text-muted-foreground">El requerimiento de pago todavía no está disponible.</p>}
      {notices.length > 0 && <div className="mt-6 border-t pt-5"><h3 className="font-semibold">Requerimientos enviados</h3>
        <ul className="mt-3 grid gap-2">{notices.map((notice) => <li key={notice.notice_id} className="grid gap-1 rounded-xl border p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="min-w-0"><p className="font-medium">{notice.subject}</p><p className="break-all text-muted-foreground">Para {notice.recipient_name ? `${notice.recipient_name} · ` : ""}{notice.recipient_email}</p><p className="text-xs text-muted-foreground">{formatMoment.format(new Date(notice.created_at))} · {notice.debt_count} {notice.debt_count === 1 ? "deuda" : "deudas"} · {formatCop(notice.total)}</p>
            <Link href={`/juridica/respuestas/${notice.notice_id}`} className="mt-1 inline-block text-xs text-primary hover:underline">{notice.replies ? `${notice.replies} ${notice.replies === 1 ? "respuesta" : "respuestas"} · ver conversación →` : "Ver conversación →"}</Link></div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${notice.delivery_status === "accepted" ? "bg-primary/12 text-primary" : notice.delivery_status === "failed" || notice.delivery_status === "cancelled" ? "bg-red-100 text-red-800" : "bg-secondary"}`}>{deliveryLabels[notice.delivery_status] ?? notice.delivery_status}</span>
        </li>)}</ul></div>}
    </CardContent></Card>

    <Card><CardContent><h2 className="text-lg font-semibold">Contacto del residente</h2>
      {detail.contacts.length ? <ul className="mt-3 grid gap-2">{detail.contacts.map((contact, index) => <li key={index} className="rounded-xl border p-3 text-sm">
        <p className="font-medium">{contact.name ?? "Sin nombre"}{contact.type && <span className="font-normal text-muted-foreground"> · {contact.type}</span>}{contact.primary && <span className="ml-2 rounded-full bg-primary/12 px-2 py-0.5 text-xs text-primary">Principal</span>}</p>
        <p className="break-all text-muted-foreground">{[contact.email, contact.phone].filter(Boolean).join(" · ") || "Sin correo ni teléfono"}</p>
      </li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">El censo no tiene contactos de este apartamento.</p>}
    </CardContent></Card>
    </>}

    {tab === "cartera" && <>
    <Card><CardContent><h2 className="text-lg font-semibold">Cobros</h2>
      <section aria-label="Cuotas y cobros" className="mt-4"><h3 className="text-sm font-semibold">Cuotas y cobros</h3>
      {detail.receivables.length ? <div className="mt-2 overflow-hidden rounded-xl border"><div className="overflow-x-auto"><table className={tableClass}>{columns}<thead><tr className={tableHead}><th className="px-3 py-2 font-medium">Concepto</th><th className="px-3 py-2 font-medium">Vence</th><th className="px-3 py-2 text-right font-medium">Valor</th><th className="px-3 py-2 text-right font-medium">Pendiente</th></tr></thead>
        <tbody>{sortedReceivables.map((row, index) => <tr key={index} className={`border-b last:border-0 ${row.status === "void" ? "text-muted-foreground" : ""}`}>
          <td className="px-3 py-2"><span className={row.status === "void" ? "line-through" : ""}>{row.concept}</span>{row.status === "void" && <span className="text-xs text-muted-foreground"> · anulado</span>}{agreementDebtIds && row.status === "active" && Number(row.outstanding) > 0 && !agreementDebtIds.has(row.id) && <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">No está en el acuerdo de pago</span>}</td>
          <td className={`px-3 py-2 ${row.status === "active" && Number(row.outstanding) > 0 && row.due_on < detail.today ? "text-red-700" : ""}`}>{formatDay(row.due_on)}</td>
          <td className="px-3 py-2 text-right">{formatCop(row.amount)}</td><td className="px-3 py-2 text-right font-medium">{row.status === "void" ? "—" : Number(row.outstanding) <= 0 ? <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">Pagada</span> : formatCop(row.outstanding)}</td>
        </tr>)}</tbody></table></div></div> : <p className="mt-1 text-sm text-muted-foreground">Sin cobros registrados.</p>}
      </section>

      {/* Acuerdos de pago debajo de los cobros, en su propia sección dentro del cuadro (05/11/2026). */}
      <section aria-label="Acuerdos de pago" className="mt-6"><h3 className="text-sm font-semibold">Acuerdos de pago</h3>
        {agreements.length ? <div className="mt-2 grid gap-3">{agreements.map((agreement, index) => <div key={index} className="overflow-hidden rounded-xl border">
          <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2 text-sm"><span className="font-semibold">{formatCop(agreement.total)}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${agreement.status === "active" ? "bg-primary/12 text-primary" : "bg-secondary"}`}>{agreement.paid ? "Pagado" : "Vigente"}</span>{agreement.remaining !== null && !agreement.paid && <span className="text-xs font-medium">Falta {formatCop(agreement.remaining)}</span>}<span className="text-xs text-muted-foreground">desde {formatMoment.format(new Date(agreement.created_at))}</span>
            {agreement.notes && <span className="basis-full text-xs text-muted-foreground">{agreement.notes}</span>}</div>
          {agreement.installments.length > 0 && <div className="overflow-x-auto"><table className={tableClass}>{columns}<thead><tr className={tableHead}><th className="px-3 py-2 font-medium">Cuota</th><th className="px-3 py-2 font-medium">Vence</th><th className="px-3 py-2 text-right font-medium">Valor</th><th className="px-3 py-2 text-right font-medium">Estado</th></tr></thead>
            <tbody>{agreement.installments.map((installment, number) => <tr key={number} className="border-b last:border-0">
              <td className="px-3 py-2">Cuota {number + 1}</td><td className={`px-3 py-2 ${installment.state === "late" ? "text-red-700" : ""}`}>{formatDay(installment.due_on)}</td><td className="px-3 py-2 text-right">{installment.state && installment.state !== "paid" && installment.due !== installment.amount ? <>{formatCop(installment.due)} <span className="block text-xs text-muted-foreground line-through">{formatCop(installment.amount)}</span></> : formatCop(installment.amount)}</td>
              <td className="px-3 py-2 text-right">{installment.state && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${installment.state === "paid" || installment.state === "settled" ? "bg-primary/12 text-primary" : installment.state === "late" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{installmentStateLabels[installment.state]}</span>}</td>
            </tr>)}</tbody></table></div>}
        </div>)}</div> : <p className="mt-1 text-sm text-muted-foreground">Sin acuerdos de pago.</p>}
      </section>
    </CardContent></Card>

    <Card><CardContent><h2 className="text-lg font-semibold">Historial de pagos</h2>
      {postedPayments.length ? <>
        <ul className="mt-3 grid gap-2">{postedPayments.slice(0, 4).map(paymentItem)}</ul>
        {postedPayments.length > 4 && <details className="group mt-2"><summary className="cursor-pointer list-none rounded-lg px-2 py-1.5 text-sm font-medium text-primary marker:hidden hover:bg-secondary"><span className="group-open:hidden">Ver {postedPayments.length - 4} {postedPayments.length - 4 === 1 ? "pago más" : "pagos más"}</span><span className="hidden group-open:inline">Ver menos</span></summary>
          <ul className="mt-2 grid gap-2">{postedPayments.slice(4).map((row, index) => paymentItem(row, index + 4))}</ul></details>}
      </> : <p className="mt-2 text-sm text-muted-foreground">Sin pagos registrados.</p>}
    </CardContent></Card>

    <Card><CardContent><h2 className="text-lg font-semibold">Anulaciones y cancelaciones</h2>
      <p className="mt-1 text-sm text-muted-foreground">Obligaciones anuladas (administración, multas u otras deudas), acuerdos de pago cancelados y pagos anulados por la administración.</p>
      {voids.length ? <ul className="mt-3 grid gap-2">{voids.map((item) => <li key={item.key} className="grid gap-1.5 rounded-xl border border-red-300 bg-red-50 p-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 font-medium text-red-800">{item.title} · <span className="font-normal text-foreground">{item.detail}</span></p><span className="font-semibold text-red-700 line-through">{formatCop(item.amount)}</span></div>
        <div className="rounded-lg border border-red-300 bg-white p-3">
          <p className="text-xs font-semibold text-red-800">{item.verb} por la administración{item.by ? ` · ${item.by}` : ""}{item.at ? ` · ${formatMoment.format(new Date(item.at))}` : ""}</p>
          {item.reason && <p className="mt-1 text-sm text-red-900"><span className="font-semibold">Motivo:</span> {item.reason}</p>}
        </div>
        {item.note && <p><span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">{item.note}</span></p>}
      </li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Sin anulaciones ni cancelaciones.</p>}
    </CardContent></Card>
    </>}

  </PlatformPage>;
}
