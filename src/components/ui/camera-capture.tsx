"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Cámara en vivo (04/11/2026): abre la cámara del dispositivo dentro de la página, sin pasar por la galería ni
// por el selector de archivos. Por defecto la frontal; se puede cambiar a la trasera. La foto sale en JPEG.
export function CameraCapture({ title, hint, photo, onCapture, disabled = false, actionLabel = "Tomar foto" }: {
  title: string; hint: string; photo: File | null; onCapture: (file: File | null) => void; disabled?: boolean; actionLabel?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string>();
  // Vista previa de la foto tomada; el enlace temporal se libera al cambiar de foto.
  const preview = useMemo(() => photo ? URL.createObjectURL(photo) : undefined, [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  // Navegadores sin acceso a la cámara (o páginas sin HTTPS).
  const unsupported = open && !navigator.mediaDevices?.getUserMedia;
  const message = unsupported ? "Este navegador no permite usar la cámara. Abre ResiQ en Chrome o Safari del celular." : error;

  // Enciende la cámara al abrir y la apaga al cerrar o al cambiar de cámara.
  useEffect(() => {
    if (!open || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play().catch(() => undefined); }
        setError(undefined);
      })
      .catch(() => { if (!cancelled) setError("No pudimos abrir la cámara. Permite el uso de la cámara para ResiQ en el navegador e intenta de nuevo."); });
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  }, [open, facing]);

  // eslint-disable-next-line @next/next/no-img-element -- vista previa local de la foto tomada
  const previewImage = preview ? <img src={preview} alt="Foto tomada" className="size-14 rounded-lg object-cover" /> : null;

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    // La cámara frontal se ve como espejo; la foto se guarda sin voltear.
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setError("No pudimos tomar la foto. Intenta de nuevo."); return; }
      onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
      setOpen(false);
    }, "image/jpeg", 0.85);
  }

  return <div className="grid gap-2">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-3">
      <div className="flex min-w-0 items-center gap-3">
        {previewImage ?? <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground"><Camera size={18} aria-hidden="true" /></span>}
        <span className="min-w-0"><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
      </div>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => { setError(undefined); setOpen(true); }}>{photo ? "Tomar otra foto" : actionLabel}</Button>
    </div>
    {open && <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Cámara">
      <div className="flex items-center justify-between p-3 text-white"><span className="text-sm font-medium">{title}</span>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Cerrar la cámara"><X size={22} aria-hidden="true" /></button></div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay className={`max-h-full max-w-full ${facing === "user" ? "-scale-x-100" : ""}`} />
        {message && <p role="alert" className="absolute inset-x-4 top-4 rounded-lg bg-white p-3 text-sm text-destructive">{message}</p>}
      </div>
      <div className="flex items-center justify-center gap-6 p-5">
        <button type="button" onClick={() => setFacing((current) => current === "user" ? "environment" : "user")} className="rounded-full bg-white/15 p-3 text-white hover:bg-white/25" aria-label="Cambiar de cámara"><RefreshCw size={22} aria-hidden="true" /></button>
        <button type="button" onClick={capture} disabled={Boolean(message)} className="size-16 rounded-full border-4 border-white bg-white/90 disabled:opacity-40" aria-label="Tomar la foto" />
        <span className="size-12" aria-hidden="true" />
      </div>
    </div>}
  </div>;
}
