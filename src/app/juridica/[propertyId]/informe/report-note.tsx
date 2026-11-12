"use client";

import { useActionState, useState } from "react";
import { saveReportNote, type ReportNoteState } from "@/app/juridica/actions";
import { Button } from "@/components/ui/button";

// Conclusiones y recomendaciones de la abogada para el mes (12/11/2026). Se guardan como borrador editable y
// salen en el PDF y en el Excel. Al imprimir solo se ve el texto, no el cuadro de edición.
export function ReportNote({ propertyId, month, body, updatedAt }: { propertyId: string; month: string; body: string; updatedAt: string | null }) {
  const [state, action, pending] = useActionState(saveReportNote, undefined as ReportNoteState);
  const [text, setText] = useState(body);
  return <div>
    <form action={action} className="mt-3 grid gap-3 print:hidden">
      <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="month" value={month} />
      <label className="text-sm font-medium">Resumen y recomendaciones del periodo
        <textarea name="body" value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} rows={6}
          placeholder="Escribe aquí las conclusiones del mes: avances, compromisos logrados, casos a priorizar y recomendaciones para la administración."
          className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || text === body}>{pending ? "Guardando…" : "Guardar borrador"}</Button>
        <span className="text-xs text-slate-500">{text.length} / 5000{updatedAt ? ` · Última edición: ${updatedAt}` : ""}</span>
        {state?.error && <span role="alert" className="text-sm text-destructive">{state.error}</span>}
        {state?.success && <span role="status" className="text-sm text-primary">{state.success}</span>}
      </div>
    </form>
    {/* Lo que sale en el PDF. */}
    <div className="hidden whitespace-pre-line text-[13px] leading-relaxed text-slate-800 print:block">{body.trim() || "La abogada no registró conclusiones para este periodo."}</div>
  </div>;
}
