"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/date-picker";
import { FilePicker } from "@/components/ui/file-picker";
import { formatCop } from "@/lib/finance/constants";

// installment: cuota del acuerdo de pago (01/11/2026); outstanding es lo que falta de esa cuota.
export type EvidenceDebt = { id: string; label: string; outstanding: number; inReview?: boolean; installment?: boolean };
const keyOf = (item: EvidenceDebt) => `${item.installment ? "c" : "d"}:${item.id}`;
const fieldClass = "mt-2 block h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

// El residente elige la deuda a la que aplica su pago o abono, el valor, el mes y un comentario,
// y adjunta el comprobante. La administración lo acepta y queda registrado como pago. Una deuda con un
// comprobante en revisión no se puede elegir otra vez; al enviar, se marca al instante (31/10/2026). Si hay
// acuerdo de pago, sus cuotas pendientes salen primero en la lista (01/11/2026).
export function PaymentEvidenceUpload({ debts }: { debts: EvidenceDebt[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<Set<string>>(() => new Set());
  const reviewing = (item: EvidenceDebt) => Boolean(item.inReview) || sent.has(keyOf(item));
  const available = debts.filter((item) => !reviewing(item));
  const [debtId, setDebtId] = useState(() => { const open = debts.filter((item) => !item.inReview); return open.length === 1 ? keyOf(open[0]) : ""; });
  const [amount, setAmount] = useState(() => { const open = debts.filter((item) => !item.inReview); return open.length === 1 ? String(Math.round(open[0].outstanding)) : ""; });
  const [paidMonth, setPaidMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [comment, setComment] = useState("");
  const debt = available.find((item) => keyOf(item) === debtId);

  async function submit() {
    const file = selected;
    if (!debt) { setMessage("Elige la cuota o la deuda que estás pagando."); return; }
    if (!(Number(amount) > 0)) { setMessage("Escribe el valor que pagaste."); return; }
    if (!/^\d{4}-\d{2}$/.test(paidMonth)) { setMessage("Indica el mes que estás pagando."); return; }
    if (!file) { setMessage("Selecciona un comprobante."); return; }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) { setMessage("Selecciona un PDF, JPG o PNG de máximo 5 MB."); return; }
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set(debt.installment ? "installmentId" : "receivableId", debt.id); form.set("amount", amount); form.set("file", file); form.set("paidMonth", paidMonth); form.set("comment", comment.trim());
      const response = await fetch("/api/finance/evidence", { method: "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar el comprobante.");
      if (input.current) input.current.value = "";
      // La deuda queda en revisión enseguida, sin esperar a que se recargue la página.
      setSent((current) => new Set(current).add(keyOf(debt))); setDebtId(""); setAmount("");
      setSelected(null); setComment("");
      setMessage("Comprobante enviado. La administración lo revisará y registrará el pago.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo enviar el comprobante."); }
    finally { setBusy(false); }
  }

  if (!debts.length) return null;
  return <div className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-6">
    <div><h2 className="text-lg font-semibold">Enviar comprobante de pago</h2><p className="mt-1 text-sm text-muted-foreground">Elige la cuota del acuerdo o la deuda que pagas o abonas, el valor y adjunta tu comprobante para que Administración lo revise.</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">{debts.some((item) => item.installment) ? "Cuota o deuda" : "Deuda"}<select className={fieldClass} value={debtId} onChange={(event) => { setDebtId(event.target.value); const next = available.find((item) => keyOf(item) === event.target.value); if (next) setAmount(String(Math.round(next.outstanding))); }} disabled={busy}><option value="">Selecciona</option>{[{ title: "Cuotas del acuerdo de pago", items: debts.filter((item) => item.installment) }, { title: "Deudas", items: debts.filter((item) => !item.installment) }].filter((group) => group.items.length).map((group) => { const options = group.items.map((item) => <option key={keyOf(item)} value={keyOf(item)} disabled={reviewing(item)}>{item.label} · {item.installment ? "valor" : "saldo"} {formatCop(item.outstanding)}{reviewing(item) ? " · comprobante en revisión" : ""}</option>); return debts.some((item) => item.installment) ? <optgroup key={group.title} label={group.title}>{options}</optgroup> : options; })}</select></label>
      <label className="block text-sm font-medium">Valor pagado (COP)<input type="number" min={1} step={1} className={fieldClass} value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy} /></label>
      <label className="block text-sm font-medium">Mes que pagas<MonthPicker className="mt-2" value={paidMonth} onChange={setPaidMonth} disabled={busy} label="Elegir el mes que pagas" /></label>
      <label className="block text-sm font-medium">Comentario para la administración (opcional)<textarea className="mt-2 block min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={2} disabled={busy} placeholder="Ej.: abono de octubre por transferencia" /></label>
    </div>
    {debt && Number(amount) > 0 && Number(amount) < debt.outstanding && <p className="text-xs text-muted-foreground">Es un abono: quedarán {formatCop(debt.outstanding - Number(amount))} por pagar en esta {debt.installment ? "cuota" : "deuda"}.</p>}
    <FilePicker inputRef={input} files={selected ? [selected] : []} onFilesChange={(files) => { setSelected(files[0] ?? null); setMessage(""); }} title="Elige tu comprobante" hint="PDF, JPG o PNG · máximo 5 MB" disabled={busy} />
    <p className="text-xs text-muted-foreground">El comprobante no cambia el saldo hasta que Administración lo acepte.</p>
    {!available.length && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Todas tus cuotas y deudas tienen un comprobante en revisión. Cuando la administración lo registre, el saldo se actualiza.</p>}
    <div className="flex flex-wrap items-center gap-3"><Button type="button" size="sm" onClick={submit} disabled={busy || !selected || !debt}>{busy ? "Enviando…" : "Enviar comprobante"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</div>
  </div>;
}
