"use client";

import { useState } from "react";
import { FinancePolicyForm, ReceivableForm } from "@/components/finance/finance-forms";
import { PaymentAgreementForm } from "@/components/finance/payment-agreement-forms";
import { formatCop } from "@/lib/finance/constants";

type UnitOption = { id: string; label: string };
type ArrearsOption = UnitOption & { balance: number; overdueDays: number; hasAgreement: boolean };
type Tab = "obligation" | "agreement";

// Tarjeta única «Nueva obligación» de la página de Cartera: registrar una obligación (con la
// política de mora y reservas al lado) y crear un acuerdo de pago para cualquier apartamento, esté
// o no en mora. Los que ya tienen un acuerdo activo se listan, pero no se pueden elegir.
export function NewObligationCard({ propertyId, units, arrears, policy }: { propertyId: string; units: UnitOption[]; arrears: ArrearsOption[]; policy: { days: number } }) {
  const [tab, setTab] = useState<Tab>("obligation");
  const [agreementUnit, setAgreementUnit] = useState("");
  const selected = arrears.find((item) => item.id === agreementUnit);
  const tabs: [Tab, string][] = [["obligation", "Obligación"], ["agreement", "Acuerdo de pago"]];

  return <div className="rounded-xl border bg-card p-5 sm:p-6">
    <h2 className="text-lg font-semibold">Nueva obligación</h2>
    <div role="tablist" aria-label="Opciones de nueva obligación" className="mt-4 flex flex-wrap gap-2">
      {tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`inline-flex min-h-10 items-center rounded-full px-3 py-1.5 text-xs font-medium sm:min-h-0 ${tab === value ? "bg-primary text-white" : "bg-secondary"}`}>{label}</button>)}
    </div>
    {/* Las pestañas quedan montadas y solo se ocultan, para no perder lo escrito al cambiar. */}
    <div role="tabpanel" hidden={tab !== "obligation"} className="mt-5"><div className="grid gap-6 lg:grid-cols-[3fr_2fr]"><div><p className="mb-5 text-sm text-muted-foreground">El saldo se calcula a partir de obligaciones y pagos; nunca se escribe directamente.</p><ReceivableForm propertyId={propertyId} units={units} agreementUnitIds={arrears.filter((item) => item.hasAgreement).map((item) => item.id)} /></div><div className="border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"><h3 className="font-semibold">Política de mora y reservas</h3><p className="mt-1 mb-5 text-sm text-muted-foreground">La deuda se revisa únicamente para el apartamento seleccionado al reservar.</p><FinancePolicyForm propertyId={propertyId} days={policy.days} /></div></div></div>
    <div role="tabpanel" hidden={tab !== "agreement"} className="mt-5">{arrears.length ? <div className="grid gap-5">
        <p className="text-sm text-muted-foreground">Elige el apartamento, esté o no en mora. Cada apartamento puede tener un acuerdo activo; para hacer otro, cancela el actual desde su estado de cuenta. El residente verá el acuerdo y su próxima cuota.</p>
        <label className="block text-sm font-medium">Apartamento<select className="mt-2 block h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={agreementUnit} onChange={(event) => setAgreementUnit(event.target.value)}><option value="">Selecciona</option>{arrears.map((item) => <option key={item.id} value={item.id} disabled={item.hasAgreement}>{item.label} · {formatCop(item.balance)}{item.overdueDays > 0 ? ` · ${item.overdueDays} ${item.overdueDays === 1 ? "día" : "días"} en mora` : ""}{item.hasAgreement ? " · ya tiene acuerdo activo" : ""}</option>)}</select></label>
        {selected && <PaymentAgreementForm key={selected.id} propertyId={propertyId} unitId={selected.id} suggestedTotal={selected.balance} />}
      </div> : <p className="text-sm text-muted-foreground">No hay apartamentos activos.</p>}</div>
  </div>;
}
