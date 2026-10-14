"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PaymentEvidenceUpload({ receivableId }: { receivableId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    const file = input.current?.files?.[0];
    if (!file) { setMessage("Selecciona un comprobante."); return; }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) { setMessage("Selecciona un PDF, JPG o PNG de máximo 5 MB."); return; }
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("receivableId", receivableId); form.set("file", file);
      const response = await fetch("/api/finance/evidence", { method: "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar el comprobante.");
      if (input.current) input.current.value = "";
      setMessage("Comprobante enviado. La administración debe revisarlo y registrar el pago.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo enviar el comprobante."); }
    finally { setBusy(false); }
  }

  return <div className="mt-4 grid gap-3 rounded-lg border bg-secondary/40 p-3">
    <label className="text-sm font-medium">Enviar comprobante de pago<input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} className="mt-2 block w-full text-sm" /></label>
    <p className="text-xs text-muted-foreground">PDF, JPG o PNG, máximo 5 MB. Enviarlo no registra el pago automáticamente.</p>
    <div className="flex flex-wrap items-center gap-3"><Button type="button" size="sm" variant="outline" onClick={submit} disabled={busy}>{busy ? "Enviando…" : "Enviar comprobante"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</div>
  </div>;
}
