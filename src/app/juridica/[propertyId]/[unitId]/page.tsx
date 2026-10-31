import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { CollectionNoticeForm } from "@/components/legal/collection-notice-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { formatCop } from "@/lib/finance/constants";
import { formatDay, formatMoment, uuidPattern } from "../../legal-data";

type Detail = {
  unit: { building: string; code: string; floor: string | null }; property: string; overdue_days: number; today: string; signer: string | null;
  contacts: { name: string | null; type: string | null; email: string | null; phone: string | null; primary: boolean }[];
  receivables: { id: string; concept: string; amount: number; outstanding: number; issued_on: string; due_on: string; status: string; source: string }[];
  payments: { amount: number; paid_on: string; reference: string | null; status: string }[];
  agreements: { total: number; status: string; notes: string | null; created_at: string; installments: { amount: number; due_on: string }[] }[];
};
const sourceLabels: Record<string, string> = { import: "Excel", manual: "Manual", opening_balance: "Saldo inicial" };
type Notice = { notice_id: string; created_at: string; recipient_email: string; recipient_name: string | null; subject: string; total: number; debt_count: number; delivery_status: string };
const deliveryLabels: Record<string, string> = { held: "Retenido (modo de prueba)", queued: "En cola", processing: "Enviando", accepted: "Enviado", failed: "No se pudo enviar", cancelled: "Cancelado" };

// Detalle de un apartamento para la abogada (31/10/2026), en solo lectura (cada consulta queda en auditoría),
// con el requerimiento de pago debajo de los cobros.
export default async function LegalUnitPage({ params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
  const { propertyId, unitId } = await params;
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

  return <PlatformPage eyebrow={detail.property} title={`${detail.unit.building} · ${detail.unit.code}`} description="Cartera en solo lectura. Los cambios los hace la administración del conjunto."
    back={<Link href={`/juridica/${propertyId}`} className="text-sm text-muted-foreground hover:text-foreground">← Cartera del conjunto</Link>}
    actions={oldest && days >= detail.overdue_days ? <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">En mora · {days} días</span> : <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Sin mora para cobro</span>}>
    <section aria-label="Saldo" className="grid gap-4 sm:grid-cols-3">
      <Card><CardContent><p className="text-2xl font-semibold">{formatCop(outstanding)}</p><p className="mt-1 text-sm text-muted-foreground">Saldo pendiente</p></CardContent></Card>
      <Card><CardContent><p className="text-2xl font-semibold text-red-700">{formatCop(overdue)}</p><p className="mt-1 text-sm text-muted-foreground">Vencido</p></CardContent></Card>
      <Card><CardContent><p className="text-2xl font-semibold">{days}</p><p className="mt-1 text-sm text-muted-foreground">Días desde la deuda más antigua sin pagar</p></CardContent></Card>
    </section>

    <Card><CardContent><h2 className="text-lg font-semibold">Contactos del censo</h2>
      {detail.contacts.length ? <ul className="mt-3 grid gap-2">{detail.contacts.map((contact, index) => <li key={index} className="rounded-xl border p-3 text-sm">
        <p className="font-medium">{contact.name ?? "Sin nombre"}{contact.type && <span className="font-normal text-muted-foreground"> · {contact.type}</span>}{contact.primary && <span className="ml-2 rounded-full bg-primary/12 px-2 py-0.5 text-xs text-primary">Principal</span>}</p>
        <p className="break-all text-muted-foreground">{[contact.email, contact.phone].filter(Boolean).join(" · ") || "Sin correo ni teléfono"}</p>
      </li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">El censo no tiene contactos de este apartamento.</p>}
    </CardContent></Card>

    <Card><CardContent><h2 className="text-lg font-semibold">Cobros</h2>
      {detail.receivables.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3 font-medium">Concepto</th><th className="py-2 pr-3 font-medium">Vence</th><th className="py-2 pr-3 text-right font-medium">Valor</th><th className="py-2 text-right font-medium">Pendiente</th></tr></thead>
        <tbody>{detail.receivables.map((row, index) => <tr key={index} className={`border-b last:border-0 ${row.status === "void" ? "text-muted-foreground" : ""}`}>
          <td className="py-2 pr-3"><span className={row.status === "void" ? "line-through" : ""}>{row.concept}</span> <span className="text-xs text-muted-foreground">· {sourceLabels[row.source] ?? row.source}{row.status === "void" ? " · anulado" : ""}</span></td>
          <td className={`py-2 pr-3 ${row.status === "active" && Number(row.outstanding) > 0 && row.due_on < detail.today ? "text-red-700" : ""}`}>{formatDay(row.due_on)}</td>
          <td className="py-2 pr-3 text-right">{formatCop(row.amount)}</td><td className="py-2 text-right font-medium">{row.status === "void" ? "—" : formatCop(row.outstanding)}</td>
        </tr>)}</tbody></table></div> : <p className="mt-2 text-sm text-muted-foreground">Sin cobros registrados.</p>}
    </CardContent></Card>

    <Card id="requerimiento" className="scroll-mt-6"><CardContent>
      <h2 className="text-lg font-semibold">Requerimiento de pago</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">Elige las deudas que vas a cobrar y escribe el mensaje. Le llega al correo del apartamento con el detalle de las deudas y tu firma.</p>
      {noticesReady ? <CollectionNoticeForm propertyId={propertyId} unitId={unitId} unitLabel={`${detail.unit.building} · ${detail.unit.code}`} propertyName={detail.property} signer={detail.signer ?? "Abogada de cobros"} debts={debts} recipients={recipients} />
        : <p className="text-sm text-muted-foreground">El requerimiento de pago todavía no está disponible.</p>}
      {notices.length > 0 && <div className="mt-6 border-t pt-5"><h3 className="font-semibold">Requerimientos enviados</h3>
        <ul className="mt-3 grid gap-2">{notices.map((notice) => <li key={notice.notice_id} className="grid gap-1 rounded-xl border p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="min-w-0"><p className="font-medium">{notice.subject}</p><p className="break-all text-muted-foreground">Para {notice.recipient_name ? `${notice.recipient_name} · ` : ""}{notice.recipient_email}</p><p className="text-xs text-muted-foreground">{formatMoment.format(new Date(notice.created_at))} · {notice.debt_count} {notice.debt_count === 1 ? "deuda" : "deudas"} · {formatCop(notice.total)}</p></div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${notice.delivery_status === "accepted" ? "bg-primary/12 text-primary" : notice.delivery_status === "failed" || notice.delivery_status === "cancelled" ? "bg-red-100 text-red-800" : "bg-secondary"}`}>{deliveryLabels[notice.delivery_status] ?? notice.delivery_status}</span>
        </li>)}</ul></div>}
    </CardContent></Card>

    <Card><CardContent><h2 className="text-lg font-semibold">Pagos</h2>
      {detail.payments.length ? <ul className="mt-3 grid gap-2">{detail.payments.map((row, index) => <li key={index} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm ${row.status === "void" ? "text-muted-foreground" : ""}`}>
        <span>{formatDay(row.paid_on)}{row.reference && <span className="text-muted-foreground"> · {row.reference}</span>}{row.status === "void" && " · anulado"}</span><span className={`font-semibold ${row.status === "void" ? "line-through" : ""}`}>{formatCop(row.amount)}</span>
      </li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Sin pagos registrados.</p>}
    </CardContent></Card>

    <Card><CardContent><h2 className="text-lg font-semibold">Acuerdos de pago</h2>
      {detail.agreements.length ? <ul className="mt-3 grid gap-3">{detail.agreements.map((agreement, index) => <li key={index} className="rounded-xl border p-3 text-sm">
        <p className="flex flex-wrap items-center gap-2 font-medium">{formatCop(agreement.total)}<span className={`rounded-full px-2 py-0.5 text-xs ${agreement.status === "active" ? "bg-primary/12 text-primary" : "bg-secondary"}`}>{agreement.status === "active" ? "Vigente" : "Cancelado"}</span><span className="text-xs font-normal text-muted-foreground">desde {formatMoment.format(new Date(agreement.created_at))}</span></p>
        {agreement.notes && <p className="mt-1 text-muted-foreground">{agreement.notes}</p>}
        {agreement.installments.length > 0 && <ol className="mt-2 grid gap-1">{agreement.installments.map((installment, number) => <li key={number} className="flex justify-between gap-3"><span>Cuota {number + 1} · {formatDay(installment.due_on)}</span><span>{formatCop(installment.amount)}</span></li>)}</ol>}
      </li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Sin acuerdos de pago.</p>}
    </CardContent></Card>
  </PlatformPage>;
}
