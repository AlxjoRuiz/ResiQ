"use client";

import { useRef, useState } from "react";
import { FilePicker } from "@/components/ui/file-picker";
import { compressImage } from "@/lib/images/compress";

// Adjuntos de la abogada (05/11/2026): el mismo selector de archivos de PQRS y comprobantes. Las fotos se
// reducen antes de enviarlas; en total hasta 5 archivos y 4 MB.
export function LegalFilesField({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  async function choose(selected: File[]) {
    setError(undefined);
    const ready = await Promise.all(selected.map((file) => file.type.startsWith("image/") ? compressImage(file).catch(() => file) : Promise.resolve(file)));
    if (ready.some((file) => !["application/pdf", "image/jpeg", "image/png"].includes(file.type))) { setError("Adjunta solo archivos PDF, JPG o PNG."); return; }
    if (ready.reduce((sum, file) => sum + file.size, 0) > 4 * 1024 * 1024) { setError("Los adjuntos pueden sumar máximo 4 MB."); return; }
    onChange(ready);
  }
  return <div className="grid gap-2">
    <FilePicker inputRef={inputRef} files={files} onFilesChange={(next) => { void choose(next); }} title="Adjuntos" hint="Opcional · hasta 5 archivos PDF, JPG o PNG · 4 MB en total" multiple maxFiles={5} disabled={disabled} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

// Pone los archivos elegidos en el envío del formulario (el selector los guarda aparte).
export function withFiles(data: FormData, files: File[]) {
  data.delete("files");
  for (const file of files) data.append("files", file);
  return data;
}
