"use client";

import { useState } from "react";
import { FinancePolicyForm, ReceivableForm } from "@/components/finance/finance-forms";
import { PaymentAgreementForm } from "@/components/finance/payment-agreement-forms";
import { formatCop } from "@/lib/finance/constants";

type UnitOption = { id: string; label: string };
type ArrearsOption = UnitOption & { balance: number; overdueDays: number };
type Tab = "obligation" | "agreement" | "policy";

// Tarjeta única «Nueva obligación» de la página de Cartera: registrar una obligación, crear un
// acuerdo de pago para un apartamento en mora y ajustar la política de mora y reservas.
export function NewObligationCard({ propertyId, units, arrears, policy }: { propertyId: string; units: UnitOption[]; arrears: ArrearsOption[]; policy: { restrict: boolean; days: number } }) {
  const [tab, setTab] = useState<Tab>("obligation");
  const [agreementUnit, setAgreementUnit] = useState("");
  const selected = arrears.find((item) => item.id === agreementUnit);
  const tabs: [Tab, string][] = [["obligation", "Obligación"], ["agreement", "Acuerdo de pago"], ["policy", "Política de mora"]];

  return <div className="rounded-xl border bg-card p-5 sm:p-6">
    <h2 className="text-lg font-semibold">Nueva obligación</h2>
    <div role="tablist" aria-label="Opciones de nueva obligación" className="mt-4 flex flex-wrap gap-2">
      {tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`inline-flex min-h-10 items-center rounded-full px-3 py-1.5 text-xs font-medium sm:min-h-0 ${tab === value ? "bg-primary text-white" : "bg-secondary"}`}>{label}</button>)}
    </div>
    <div role="tabpanel" className="mt-5">
      {tab === "obligation" && <><p className="mb-5 text-sm text-muted-foreground">El saldo se calcula a partir de obligaciones y pagos; nunca se escribe directamente.</p><ReceivableForm propertyId={propertyId} units={units} /></>}
      {tab === "agreement" && (arrears.length ? <div className="grid gap-5">
        <p className="text-sm text-muted-foreground">Elige un apartamento en mora sin acuerdo activo. El residente verá el acuerdo y su próxima cuota.</p>
        <label className="block text-sm font-medium">Apartamento<select className="mt-2 block h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={agreementUnit} onChange={(event) => setAgreementUnit(event.target.value)}><option value="">Selecciona</option>{arrears.map((item) => <option key={item.id} value={item.id}>{item.label} · {formatCop(item.balance)} · {item.overdueDays} {item.overdueDays === 1 ? "día" : "días"} en mora</option>)}</select></label>
        {selected && <PaymentAgreementForm key={selected.id} propertyId={propertyId} unitId={selected.id} suggestedTotal={selected.balance} />}
      </div> : <p className="text-sm text-muted-foreground">No hay apartamentos en mora sin acuerdo activo.</p>)}
      {tab === "policy" && <><p className="mb-5 text-sm text-muted-foreground">La deuda se revisa únicamente para el apartamento seleccionado al reservar.</p><FinancePolicyForm propertyId={propertyId} restrict={policy.restrict} days={policy.days} /></>}
    </div>
  </div>;
}
