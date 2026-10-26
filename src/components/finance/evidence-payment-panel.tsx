"use client";

import { useState, useTransition } from "react";
import { markEvidenceReceived } from "@/app/panel/propiedades/[propertyId]/cartera/actions";
import { PaymentForm, type OpenReceivable, type PaymentPrefill } from "@/components/finance/finance-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { statusPill } from "@/lib/ui/status-tones";

export type EvidenceRow = { id: string; receivableId: string; concept: string; originalName: string; uploadedAt: string; uploadedDay: string; receivedAt: string | null };

// Comprobantes de pago del apartamento y, al lado, «Registrar pago». «Recibido» marca el
// comprobante y llena el formulario con la obligación de ese comprobante para revisarlo y guardar.
export function EvidencePaymentPanel({ propertyId, unitId, evidences, receivables }: { propertyId: string; unitId: string; evidences: EvidenceRow[]; receivables: OpenReceivable[] }) {
  const [prefill, setPrefill] = useState<PaymentPrefill & { key: string }>();
  const [error, setError] = useState<string>();
  const [pendingId, setPendingId] = useState<string>();
  const [, startTransition] = useTransition();

  function receive(evidence: EvidenceRow) {
    setError(undefined); setPendingId(evidence.id);
    startTransition(async () => {
      const result = evidence.receivedAt ? undefined : await markEvidenceReceived(propertyId, unitId, evidence.id);
      setPendingId(undefined);
      if (result?.error) { setError(result.error); return; }
      const outstanding = receivables.find((item) => item.id === evidence.receivableId)?.outstanding ?? 0;
      if (outstanding > 0) setPrefill({ key: evidence.id, amount: outstanding, paidOn: evidence.uploadedDay, reference: `Comprobante: ${evidence.originalName}`.slice(0, 120), receivableId: evidence.receivableId });
    });
  }

  return <section className="mt-7 grid gap-6 lg:grid-cols-2">
    <Card><CardContent>
      <h2 className="text-lg font-semibold">Comprobantes de pago</h2>
      <p className="mt-2 text-sm text-muted-foreground">Los comprobantes que sube el residente. Revísalo, pulsa «Recibido» y confirma el pago al lado.</p>
      <div className="mt-5 grid gap-3">
        {evidences.map((evidence) => <article key={evidence.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><a href={`/api/finance/evidence/${evidence.id}`} target="_blank" rel="noopener noreferrer" className="break-words font-medium text-primary underline underline-offset-2">{evidence.originalName}</a><p className="mt-1 text-xs text-muted-foreground">{evidence.concept} · cargado {evidence.uploadedAt}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill[evidence.receivedAt ? "success" : "warning"]}`}>{evidence.receivedAt ? "Recibido" : "Por revisar"}</span>
          </div>
          {evidence.receivedAt && <p className="mt-2 text-xs text-muted-foreground">Recibido {evidence.receivedAt}</p>}
          <div className="mt-3"><Button type="button" size="sm" variant={evidence.receivedAt ? "outline" : "default"} disabled={pendingId === evidence.id} onClick={() => receive(evidence)}>{pendingId === evidence.id ? "Marcando…" : evidence.receivedAt ? "Usar en el pago" : "Recibido"}</Button></div>
        </article>)}
        {!evidences.length && <p className="text-sm text-muted-foreground">El residente aún no ha subido comprobantes.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </CardContent></Card>
    <Card><CardContent>
      <h2 className="text-lg font-semibold">Registrar pago</h2>
      <p className="mt-2 text-sm text-muted-foreground">{prefill ? "Datos tomados del comprobante. Revisa el valor antes de guardar." : "Puedes proponer la distribución por antigüedad y revisarla antes de guardar."}</p>
      <div className="mt-5"><PaymentForm key={prefill?.key ?? "manual"} propertyId={propertyId} unitId={unitId} receivables={receivables} prefill={prefill} /></div>
    </CardContent></Card>
  </section>;
}
