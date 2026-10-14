"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";

export function PaymentEvidenceUpload({ receivableId }: { receivableId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  async function submit() {
    const file = selected;
    if (!file) { setMessage("Selecciona un comprobante."); return; }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) { setMessage("Selecciona un PDF, JPG o PNG de máximo 5 MB."); return; }
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("receivableId", receivableId); form.set("file", file);
      const response = await fetch("/api/finance/evidence", { method: "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar el comprobante.");
      if (input.current) input.current.value = "";
      setSelected(null);
      setMessage("Comprobante enviado. La administración debe revisarlo y registrar el pago.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo enviar el comprobante."); }
    finally { setBusy(false); }
  }

  return <div className="mt-4 grid gap-3 rounded-xl border bg-secondary/30 p-4">
    <div><p className="text-sm font-semibold">Comprobante de pago</p><p className="mt-1 text-xs text-muted-foreground">Adjunta una imagen o PDF para que Administración lo revise.</p></div>
    <FilePicker inputRef={input} files={selected ? [selected] : []} onFilesChange={(files) => { setSelected(files[0] ?? null); setMessage(""); }} title="Elige tu comprobante" hint="PDF, JPG o PNG · máximo 5 MB" disabled={busy} />
    <p className="text-xs text-muted-foreground">El comprobante no registra el pago ni cambia el saldo automáticamente.</p>
    <div className="flex flex-wrap items-center gap-3"><Button type="button" size="sm" onClick={submit} disabled={busy || !selected}>{busy ? "Enviando…" : "Enviar comprobante"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</div>
  </div>;
}
