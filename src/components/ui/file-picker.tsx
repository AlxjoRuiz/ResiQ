"use client";

import type { RefObject } from "react";
import { Trash2 } from "lucide-react";
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
  maxFiles?: number;
};

export function FilePicker({ inputRef, files, onFilesChange, title, hint, multiple = false, disabled = false, accept = "application/pdf,image/jpeg,image/png", name, maxFiles }: FilePickerProps) {
  function remove(index: number) {
    if (inputRef.current) inputRef.current.value = "";
    onFilesChange(files.filter((_, position) => position !== index));
  }
  return <div className="grid min-w-0 gap-2">
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-background p-3 sm:p-4">
      <input ref={inputRef} type="file" name={name} multiple={multiple} accept={accept} disabled={disabled} className="sr-only" tabIndex={-1} aria-label={title} onChange={(event) => { const incoming = Array.from(event.currentTarget.files ?? []); onFilesChange(multiple ? [...files, ...incoming] : incoming.slice(0, 1)); if (multiple) event.currentTarget.value = ""; }} />
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{hint}</p></div>
      <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={disabled || (maxFiles !== undefined && files.length >= maxFiles)}>{files.length ? "Agregar más archivos" : "Agregar archivo"}</Button>
    </div>
    {files.length > 0 && <ul className="grid gap-2 text-sm" aria-label={`Archivos seleccionados: ${title}`}>{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2"><span className="min-w-0 break-words">{file.name}</span><Button type="button" size="icon" variant="ghost" disabled={disabled} aria-label={`Quitar ${file.name}`} title={`Quitar ${file.name}`} onClick={() => remove(index)}><Trash2 className="size-4" aria-hidden="true" /></Button></li>)}</ul>}
  </div>;
}
