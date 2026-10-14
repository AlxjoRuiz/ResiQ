"use client";

import type { RefObject } from "react";
import { FileCheck2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";

type FilePickerProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  files: File[];
  onFilesChange: (files: File[]) => void;
  title: string;
  hint: string;
  multiple?: boolean;
  disabled?: boolean;
  accept?: string;
  name?: string;
};

export function FilePicker({ inputRef, files, onFilesChange, title, hint, multiple = false, disabled = false, accept = "application/pdf,image/jpeg,image/png", name }: FilePickerProps) {
  const summary = files.length === 0 ? "Elige un archivo" : files.length === 1 ? files[0].name : `${files.length} archivos seleccionados`;
  const detail = files.length === 0 ? hint : files.length === 1 ? `${(files[0].size / 1024 / 1024).toFixed(2)} MB · listo para enviar` : `${files.map((file) => file.name).join(", ")}`;
  return <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-background p-3 sm:p-4">
    <input ref={inputRef} type="file" name={name} multiple={multiple} accept={accept} disabled={disabled} className="sr-only" tabIndex={-1} aria-label={title} onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))} />
    <div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">{files.length ? <FileCheck2 className="size-5" /> : <FileUp className="size-5" />}</div>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" aria-live="polite">{files.length ? summary : title}</p><p className="truncate text-xs text-muted-foreground" title={files.length > 1 ? detail : undefined}>{detail}</p></div>
    <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={disabled}>{files.length ? multiple ? "Cambiar archivos" : "Cambiar archivo" : multiple ? "Elegir archivos" : "Elegir archivo"}</Button>
  </div>;
}
