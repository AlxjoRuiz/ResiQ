import Link from "next/link";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { formatMoment } from "../legal-data";

type Thread = { notice_id: string; property_name: string; unit_label: string; recipient_email: string; recipient_name: string | null; subject: string; last_message: string; last_author: string; last_at: string; unread: number };

// Respuestas (31/10/2026): las conversaciones de los requerimientos de pago en las que el residente
// respondió desde su correo. Las que tienen respuestas sin leer van marcadas.
export default async function LegalRepliesPage() {
  const { supabase } = await requireLegalStaff();
  const { data, error } = await supabase.rpc("legal_list_threads");
  const threads = (data ?? []) as Thread[];
  return <PlatformPage eyebrow="Cobro jurídico" title="Respuestas" description="Lo que responden los residentes a tus requerimientos de pago. Toca una para leerla y contestar.">
    {error ? <p className="rounded-2xl border bg-white p-5 text-sm text-muted-foreground">Las respuestas todavía no están disponibles.</p>
      : threads.length ? <ul className="grid gap-3">{threads.map((thread) => <li key={thread.notice_id}><Link href={`/juridica/respuestas/${thread.notice_id}`} className={`block rounded-2xl border bg-white p-5 transition-colors hover:border-primary/40 hover:bg-secondary/40 ${thread.unread ? "border-primary/40" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-semibold">{thread.unread > 0 && <span aria-hidden="true" className="size-2.5 rounded-full bg-red-500" />}{thread.unit_label} · {thread.property_name}</p><p className="break-all text-sm text-muted-foreground">{thread.recipient_name ? `${thread.recipient_name} · ` : ""}{thread.recipient_email}</p></div>
          <span className="shrink-0 text-xs text-muted-foreground">{formatMoment.format(new Date(thread.last_at))}</span></div>
        <p className="mt-3 line-clamp-2 text-sm"><span className="text-muted-foreground">{thread.last_author === "lawyer" ? "Tú: " : ""}</span>{thread.last_message}</p>
        {thread.unread > 0 && <p className="mt-2 text-xs font-medium text-primary">{thread.unread} {thread.unread === 1 ? "respuesta sin leer" : "respuestas sin leer"}</p>}
      </Link></li>)}</ul>
      : <p className="rounded-2xl border bg-white p-5 text-sm text-muted-foreground">Todavía no hay respuestas. Cuando un residente responda un requerimiento desde su correo, aparece aquí.</p>}
  </PlatformPage>;
}
