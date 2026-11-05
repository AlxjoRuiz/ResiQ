import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { CollectionNoticeForm } from "@/components/legal/collection-notice-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { formatCop } from "@/lib/finance/constants";
import { deliveryLabels, formatDay, formatMoment, uuidPattern } from "../../legal-data";

type Detail = {
  unit: { building: string; code: string; floor: string | null }; property: string; overdue_days: number; today: string; signer: string | null;
  contacts: { name: string | null; type: string | null; email: string | null; phone: string | null; primary: boolean }[];
  receivables: { id: string; concept: string; amount: number; outstanding: number; issued_on: string; due_on: string; status: string; source: string }[];
  // Historial de pagos (04/11/2026): lo pagado, el comprobante, la anulación y si fue corregido.
  // Quién pagó y quién anuló (05/11/2026).
  payments: { id?: string; amount: number; paid_on: string; reference: string | null; status: string; recorded_at?: string; voided_at?: string | null; void_reason?: string | null; concepts?: string | null; evidence_id?: string | null; evidence_name?: string | null; payer_name?: string | null; recorded_by_name?: string | null; voided_by_name?: string | null; corrected_on?: string | null; corrects?: boolean }[];
  agreements: { total: number; status: string; notes: string | null; created_at: string; installments: { amount: number; due_on: string }[] }[];
};
// Encabezado de tabla con el azul de ResiQ y bordes redondeados (05/11/2026).
const tableHead = "bg-primary text-left text-primary-foreground";
const installmentLabels = { paid: "Pagada", late: "Vencida", pending: "Por vencer" } as const;
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
  // Acuerdos de pago (05/11/2026): las cuotas del acuerdo vigente se cubren en orden con los pagos registrados
  // después de crearlo (la misma regla que la cartera del administrador).
  const agreements = detail.agreements.map((agreement) => {
    const paidSince = agreement.status === "active" ? detail.payments.filter((row) => row.status === "posted" && row.recorded_at && Date.parse(row.recorded_at) >= Date.parse(agreement.created_at)).reduce((sum, row) => sum + Number(row.amount), 0) : 0;
    const installments = agreement.installments.reduce<{ rows: { amount: number; due_on: string; state: keyof typeof installmentLabels | null }[]; covered: number }>((acc, item) => {
      const covered = acc.covered + Number(item.amount);
      const state = agreement.status !== "active" ? null : covered <= paidSince ? "paid" : item.due_on < detail.today ? "late" : "pending";
      return { rows: [...acc.rows, { amount: Number(item.amount), due_on: item.due_on, state }], covered };
    }, { rows: [], covered: 0 }).rows;
    return { ...agreement, installments };
  });

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
      {/* Acuerdos de pago arriba, en su propia sección dentro del cuadro (05/11/2026). */}
      <section aria-label="Acuerdos de pago" className="mt-4"><h3 className="text-sm font-semibold">Acuerdos de pago</h3>
        {agreements.length ? <div className="mt-2 grid gap-3">{agreements.map((agreement, index) => <div key={index} className="overflow-hidden rounded-xl border">
          <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2 text-sm"><span className="font-semibold">{formatCop(agreement.total)}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${agreement.status === "active" ? "bg-primary/12 text-primary" : "bg-secondary"}`}>{agreement.status === "active" ? "Vigente" : "Cancelado"}</span><span className="text-xs text-muted-foreground">desde {formatMoment.format(new Date(agreement.created_at))}</span>
            {agreement.notes && <span className="basis-full text-xs text-muted-foreground">{agreement.notes}</span>}</div>
          {agreement.installments.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead><tr className={tableHead}><th className="px-3 py-2 font-medium">Cuota</th><th className="px-3 py-2 font-medium">Vence</th><th className="px-3 py-2 text-right font-medium">Valor</th><th className="px-3 py-2 text-right font-medium">Estado</th></tr></thead>
            <tbody>{agreement.installments.map((installment, number) => <tr key={number} className="border-b last:border-0">
              <td className="px-3 py-2">Cuota {number + 1}</td><td className={`px-3 py-2 ${installment.state === "late" ? "text-red-700" : ""}`}>{formatDay(installment.due_on)}</td><td className="px-3 py-2 text-right">{formatCop(installment.amount)}</td>
              <td className="px-3 py-2 text-right">{installment.state && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${installment.state === "paid" ? "bg-primary/12 text-primary" : installment.state === "late" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{installmentLabels[installment.state]}</span>}</td>
            </tr>)}</tbody></table></div>}
        </div>)}</div> : <p className="mt-1 text-sm text-muted-foreground">Sin acuerdos de pago.</p>}
      </section>

      <section aria-label="Cuotas y cobros" className="mt-6"><h3 className="text-sm font-semibold">Cuotas y cobros</h3>
      {detail.receivables.length ? <div className="mt-2 overflow-hidden rounded-xl border"><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className={tableHead}><th className="px-3 py-2 font-medium">Concepto</th><th className="px-3 py-2 font-medium">Vence</th><th className="px-3 py-2 text-right font-medium">Valor</th><th className="px-3 py-2 text-right font-medium">Pendiente</th></tr></thead>
        <tbody>{sortedReceivables.map((row, index) => <tr key={index} className={`border-b last:border-0 ${row.status === "void" ? "text-muted-foreground" : ""}`}>
          <td className="px-3 py-2"><span className={row.status === "void" ? "line-through" : ""}>{row.concept}</span>{row.status === "void" && <span className="text-xs text-muted-foreground"> · anulado</span>}</td>
          <td className={`px-3 py-2 ${row.status === "active" && Number(row.outstanding) > 0 && row.due_on < detail.today ? "text-red-700" : ""}`}>{formatDay(row.due_on)}</td>
          <td className="px-3 py-2 text-right">{formatCop(row.amount)}</td><td className="px-3 py-2 text-right font-medium">{row.status === "void" ? "—" : Number(row.outstanding) <= 0 ? <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">Pagada</span> : formatCop(row.outstanding)}</td>
        </tr>)}</tbody></table></div></div> : <p className="mt-1 text-sm text-muted-foreground">Sin cobros registrados.</p>}
      </section>
    </CardContent></Card>

    <Card><CardContent><h2 className="text-lg font-semibold">Historial de pagos</h2>
      {detail.payments.length ? <ul className="mt-3 grid gap-2">{detail.payments.map((row, index) => { const voided = row.status === "void"; const byResident = Boolean(row.evidence_id && row.payer_name); return <li key={row.id ?? index} className={`grid gap-1.5 rounded-xl border p-3 text-sm ${voided ? "border-red-300 bg-red-50" : "border-primary/40 bg-primary/5"}`}>
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
      </li>; })}</ul> : <p className="mt-2 text-sm text-muted-foreground">Sin pagos registrados.</p>}
    </CardContent></Card>
    </>}

  </PlatformPage>;
}
