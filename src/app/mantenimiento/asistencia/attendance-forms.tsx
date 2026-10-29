"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { compressImage } from "@/lib/images/compress";
import { closeAttendance, type AttendanceState } from "./actions";

// Botón grande para marcar llegada o salida (pensado para celular). Abre la cámara frontal; la foto es
// obligatoria y se reduce antes de subirla. La hora la pone el servidor al recibirla.
export function CheckInOutForm({ kind }: { kind: "in" | "out" }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const label = kind === "in" ? "Marcar llegada" : "Marcar salida";

  async function choose(file?: File) {
    setError(undefined);
    if (!file) return;
    try {
      const reduced = await compressImage(file);
      if (preview) URL.revokeObjectURL(preview);
      setPhoto(reduced); setPreview(URL.createObjectURL(reduced));
    } catch { setError("No pudimos leer la foto. Tómala de nuevo."); }
  }

  async function send() {
    if (!photo) { setError("Toma la foto para marcar."); return; }
    setSending(true); setError(undefined);
    const body = new FormData();
    body.set("kind", kind); body.set("photo", photo);
    try {
      const response = await fetch("/api/maintenance/attendance", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error ?? "No pudimos marcar. Intenta de nuevo."); return; }
      if (preview) URL.revokeObjectURL(preview);
      setPhoto(null); setPreview(null);
      router.refresh();
    } catch { setError("Sin conexión. Revisa el internet e intenta de nuevo."); }
    finally { setSending(false); }
  }

  return <div className="grid gap-3">
    {/* capture="user": en el celular abre directamente la cámara frontal. */}
    <input ref={inputRef} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} aria-label={`Foto para ${label.toLowerCase()}`} onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
    {preview ? <>
      {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local de la foto recién tomada */}
      <img src={preview} alt="Foto tomada" className="mx-auto max-h-72 rounded-2xl border object-contain" />
      <div className="grid gap-2 sm:grid-cols-2"><Button className="h-14 text-base" disabled={sending} onClick={send}>{sending ? "Marcando…" : label}</Button><Button variant="outline" className="h-14 text-base" disabled={sending} onClick={() => inputRef.current?.click()}>Tomar otra foto</Button></div>
    </> : <Button className="h-16 text-lg" onClick={() => inputRef.current?.click()}><Camera size={22} aria-hidden="true" />{label} con foto</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

// Admin: registrar a mano la salida olvidada, con la hora y el motivo.
export function CloseAttendanceForm({ attendanceId, defaultTime }: { attendanceId: string; defaultTime: string }) {
  const [state, action, pending] = useFormActionState(closeAttendance, undefined as AttendanceState);
  return <details className="mt-2"><summary className="cursor-pointer text-sm font-medium text-primary">Registrar salida a mano</summary>
    <form onSubmit={action} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="attendanceId" value={attendanceId} />
      <label className="text-sm font-medium">Hora de salida<input name="checkOutAt" type="datetime-local" defaultValue={defaultTime} required className="mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm" /></label>
      <label className="text-sm font-medium">Motivo<input name="reason" required minLength={3} maxLength={300} placeholder="Olvidó marcar la salida" className="mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm" /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Button size="sm" disabled={pending}>{pending ? "Guardando…" : "Registrar salida"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</div>
    </form>
  </details>;
}
