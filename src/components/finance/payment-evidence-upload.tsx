"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/date-picker";
import { FilePicker } from "@/components/ui/file-picker";
import { formatCop } from "@/lib/finance/constants";

export type EvidenceDebt = { id: string; label: string; outstanding: number };
const fieldClass = "mt-2 block h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

// El residente elige la deuda a la que aplica su pago o abono, el valor, el mes y un comentario,
// y adjunta el comprobante. La administración lo acepta y queda registrado como pago.
export function PaymentEvidenceUpload({ debts }: { debts: EvidenceDebt[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [debtId, setDebtId] = useState(debts.length === 1 ? debts[0].id : "");
  const [amount, setAmount] = useState(debts.length === 1 ? String(Math.round(debts[0].outstanding)) : "");
  const [paidMonth, setPaidMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [comment, setComment] = useState("");
  const debt = debts.find((item) => item.id === debtId);

  async function submit() {
    const file = selected;
    if (!debt) { setMessage("Elige la deuda que estás pagando."); return; }
    if (!(Number(amount) > 0)) { setMessage("Escribe el valor que pagaste."); return; }
    if (!/^\d{4}-\d{2}$/.test(paidMonth)) { setMessage("Indica el mes que estás pagando."); return; }
    if (!file) { setMessage("Selecciona un comprobante."); return; }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) { setMessage("Selecciona un PDF, JPG o PNG de máximo 5 MB."); return; }
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("receivableId", debt.id); form.set("amount", amount); form.set("file", file); form.set("paidMonth", paidMonth); form.set("comment", comment.trim());
      const response = await fetch("/api/finance/evidence", { method: "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar el comprobante.");
      if (input.current) input.current.value = "";
      setSelected(null); setComment("");
      setMessage("Comprobante enviado. La administración lo revisará y registrará el pago.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo enviar el comprobante."); }
    finally { setBusy(false); }
  }

  if (!debts.length) return null;
  return <div className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-6">
    <div><h2 className="text-lg font-semibold">Enviar comprobante de pago</h2><p className="mt-1 text-sm text-muted-foreground">Elige la deuda que pagas o abonas, el valor y adjunta tu comprobante para que Administración lo revise.</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">Deuda<select className={fieldClass} value={debtId} onChange={(event) => { setDebtId(event.target.value); const next = debts.find((item) => item.id === event.target.value); if (next) setAmount(String(Math.round(next.outstanding))); }} disabled={busy}><option value="">Selecciona</option>{debts.map((item) => <option key={item.id} value={item.id}>{item.label} · saldo {formatCop(item.outstanding)}</option>)}</select></label>
      <label className="block text-sm font-medium">Valor pagado (COP)<input type="number" min={1} step={1} className={fieldClass} value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy} /></label>
      <label className="block text-sm font-medium">Mes que pagas<MonthPicker className="mt-2" value={paidMonth} onChange={setPaidMonth} disabled={busy} label="Elegir el mes que pagas" /></label>
      <label className="block text-sm font-medium">Comentario para la administración (opcional)<textarea className="mt-2 block min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={2} disabled={busy} placeholder="Ej.: abono de octubre por transferencia" /></label>
    </div>
    {debt && Number(amount) > 0 && Number(amount) < debt.outstanding && <p className="text-xs text-muted-foreground">Es un abono: quedarán {formatCop(debt.outstanding - Number(amount))} por pagar en esta deuda.</p>}
    <FilePicker inputRef={input} files={selected ? [selected] : []} onFilesChange={(files) => { setSelected(files[0] ?? null); setMessage(""); }} title="Elige tu comprobante" hint="PDF, JPG o PNG · máximo 5 MB" disabled={busy} />
    <p className="text-xs text-muted-foreground">El comprobante no cambia el saldo hasta que Administración lo acepte.</p>
    <div className="flex flex-wrap items-center gap-3"><Button type="button" size="sm" onClick={submit} disabled={busy || !selected}>{busy ? "Enviando…" : "Enviar comprobante"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</div>
  </div>;
}
