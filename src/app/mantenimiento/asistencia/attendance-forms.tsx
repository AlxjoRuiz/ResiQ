"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { compressImage } from "@/lib/images/compress";
import { closeAttendance, type AttendanceState } from "./actions";

// Dentro de la tarjeta de asistencia (pensada para celular), dos partes independientes:
// * Foto de llegada: el mismo selector de adjuntos de la app; en el celular abre la cámara frontal.
//   La foto se reduce antes de subirla y solo se pide para la llegada.
// * Botones: «Marcar llegada» (necesita la foto) y «Marcar salida» (sin foto). Solo está activo el que
//   corresponde: llegada si no hay jornada abierta, salida si la hay. La hora la pone el servidor.
export function CheckInOutForm({ open }: { open: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  async function choose(file?: File) {
    setError(undefined);
    if (!file) { setPhoto(null); return; }
    try { setPhoto(await compressImage(file)); }
    catch { setPhoto(null); setError("No pudimos leer la foto. Tómala de nuevo."); }
  }

  async function send(kind: "in" | "out") {
    if (kind === "in" && !photo) { setError("Toma la foto para marcar la llegada."); return; }
    setSending(true); setError(undefined);
    const body = new FormData();
    body.set("kind", kind);
    if (kind === "in" && photo) body.set("photo", photo);
    try {
      const response = await fetch("/api/maintenance/attendance", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error ?? "No pudimos marcar. Intenta de nuevo."); return; }
      setPhoto(null); if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch { setError("Sin conexión. Revisa el internet e intenta de nuevo."); }
    finally { setSending(false); }
  }

  return <div className="grid gap-5">
    <section className="grid gap-2"><h2 className="text-sm font-semibold">Foto de llegada</h2>
      <FilePicker inputRef={inputRef} files={photo ? [photo] : []} onFilesChange={(files) => { void choose(files[0]); }} title="Foto con la cámara" hint={open ? "Ya marcaste tu llegada. La salida no lleva foto." : "Obligatoria para marcar la llegada"} accept="image/*" capture="user" actionLabel={photo ? "Tomar otra foto" : "Tomar foto"} disabled={open || sending} />
    </section>
    <div className="grid grid-cols-2 gap-3">
      <Button disabled={open || !photo || sending} onClick={() => send("in")}>{sending && !open ? "Marcando…" : "Marcar llegada"}</Button>
      <Button variant="outline" disabled={!open || sending} onClick={() => send("out")}><LogOut size={18} aria-hidden="true" />{sending && open ? "Marcando…" : "Marcar salida"}</Button>
    </div>
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
