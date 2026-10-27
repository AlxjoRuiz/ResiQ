"use client";

import { setPropertyPlan, setSeasonalDecor, type PlatformState } from "@/app/plataforma/actions";
import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { PLAN_ANNUAL_COP, PLAN_MONTHLY_COP, type BillingCycle } from "@/lib/platform/plans";

function Result({ state }: { state: PlatformState }) { if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>; if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>; return null; }
const cop = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function SeasonalDecorForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useFormActionState(setSeasonalDecor, undefined as PlatformState);
  return <form onSubmit={action} className="flex flex-wrap items-center gap-3"><input type="hidden" name="enabled" value={enabled ? "false" : "true"} /><Button disabled={pending} variant={enabled ? "outline" : "default"}>{pending ? "Guardando…" : enabled ? "Apagar decoración" : "Activar decoración"}</Button><Result state={state} /></form>;
}

export function PropertyPlanForm({ propertyId, cycle, paidUntil }: { propertyId: string; cycle: BillingCycle; paidUntil: string | null }) {
  const [state, action, pending] = useFormActionState(setPropertyPlan, undefined as PlatformState);
  return <form onSubmit={action} className="flex flex-wrap items-end gap-3"><input type="hidden" name="propertyId" value={propertyId} />
    <label className="grid gap-1 text-sm">Plan<select name="cycle" defaultValue={cycle} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="monthly">Mensual · {cop(PLAN_MONTHLY_COP)}</option><option value="annual">Anual · {cop(PLAN_ANNUAL_COP)}</option></select></label>
    <label className="grid gap-1 text-sm">Pagado hasta<input type="date" name="paidUntil" defaultValue={paidUntil ?? ""} className="h-10 rounded-lg border bg-white px-3 text-sm" /></label>
    <Button size="sm" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button><Result state={state} />
  </form>;
}
