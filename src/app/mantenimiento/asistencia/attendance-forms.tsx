"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimeField } from "@/components/ui/date-time-field";
import { CameraCapture } from "@/components/ui/camera-capture";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { compressImage } from "@/lib/images/compress";
import { closeAttendance, type AttendanceState } from "./actions";

// Dentro de la tarjeta de asistencia (pensada para celular), dos partes:
// * Foto: desde el 04/11/2026 se toma con la cámara en vivo (nunca de la galería) y se pide tanto para la
//   llegada como para la salida. La foto se reduce antes de subirla.
// * Botones: «Marcar llegada» y «Marcar salida», cada uno con su foto. Solo está activo el que corresponde:
//   llegada si no hay jornada abierta, salida si la hay. La hora la pone el servidor.
export function CheckInOutForm({ open }: { open: boolean }) {
  const router = useRouter();
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
    if (!photo) { setError(kind === "in" ? "Toma la foto para marcar la llegada." : "Toma la foto para marcar la salida."); return; }
    setSending(true); setError(undefined);
    const body = new FormData();
    body.set("kind", kind);
    body.set("photo", photo);
    try {
      const response = await fetch("/api/maintenance/attendance", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error ?? "No pudimos marcar. Intenta de nuevo."); return; }
      setPhoto(null);
      router.refresh();
    } catch { setError("Sin conexión. Revisa el internet e intenta de nuevo."); }
    finally { setSending(false); }
  }

  return <div className="grid gap-5">
    <section className="grid gap-2"><h2 className="text-sm font-semibold">{open ? "Foto de salida" : "Foto de llegada"}</h2>
      <CameraCapture title="Foto con la cámara" hint={open ? "Obligatoria para marcar la salida" : "Obligatoria para marcar la llegada"} photo={photo} onCapture={(file) => { void choose(file ?? undefined); }} disabled={sending} />
    </section>
    <div className="grid grid-cols-2 gap-3">
      <Button disabled={open || !photo || sending} onClick={() => send("in")}>{sending && !open ? "Marcando…" : "Marcar llegada"}</Button>
      <Button variant="outline" disabled={!open || !photo || sending} onClick={() => send("out")}><LogOut size={18} aria-hidden="true" />{sending && open ? "Marcando…" : "Marcar salida"}</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

// Admin: registrar a mano la salida olvidada, con la hora y el motivo.
export function CloseAttendanceForm({ attendanceId, defaultTime }: { attendanceId: string; defaultTime: string }) {
  const [state, action, pending] = useFormActionState(closeAttendance, undefined as AttendanceState);
  return <details className="mt-2"><summary className="cursor-pointer text-sm font-medium text-primary">Registrar salida a mano</summary>
    <form onSubmit={action} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="attendanceId" value={attendanceId} />
      <DateTimeField name="checkOutAt" label="Hora de salida" defaultValue={defaultTime} />
      <label className="text-sm font-medium">Motivo<input name="reason" required minLength={3} maxLength={300} placeholder="Olvidó marcar la salida" className="mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm" /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Button size="sm" disabled={pending}>{pending ? "Guardando…" : "Registrar salida"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</div>
    </form>
  </details>;
}
