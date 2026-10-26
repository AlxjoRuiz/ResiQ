import { Download, FileImage, FileText } from "lucide-react";

// Tarjeta de descarga de un adjunto, con el mismo diseño de los archivos de Asambleas.
export function AnnouncementFileCard({ document }: { document: { id: string; original_name: string; mime_type: string; size_bytes: number } }) {
  const isImage = document.mime_type.startsWith("image/");
  return <a href={`/api/announcements/documents/${document.id}`} className="flex min-w-0 items-center gap-3 rounded-xl border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Descargar adjunto: ${document.original_name}`}>
    <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">{isImage ? <FileImage className="size-5" /> : <FileText className="size-5" />}</span>
    <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{document.original_name}</span><span className="mt-1 block text-xs text-muted-foreground">{isImage ? "Imagen" : "PDF"} · {(Number(document.size_bytes) / 1024).toFixed(0)} KB</span></span>
    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary"><Download className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Descargar</span></span>
  </a>;
}
