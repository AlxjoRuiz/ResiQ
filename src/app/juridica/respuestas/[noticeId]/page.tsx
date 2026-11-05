import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { LegalReplyForm } from "@/components/legal/legal-reply-form";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { formatCop } from "@/lib/finance/constants";
import { deliveryLabels, formatDay, formatMoment, uuidPattern } from "../../legal-data";

type Thread = {
  notice: { id: string; property_id: string; unit_id: string; subject: string; message: string; items: { concept: string; due_on: string; outstanding: number }[]; total: number; recipient_email: string; recipient_name: string | null; created_at: string };
  property: string; unit_label: string;
  messages: { id: string; author: "resident" | "lawyer"; from_email: string | null; body: string; created_at: string; delivery_status: string | null }[];
};

// Conversación de un requerimiento de pago (31/10/2026): el requerimiento, las respuestas del residente
// (llegan desde su correo) y lo que contesta la abogada, que le llega al residente por correo.
export default async function LegalThreadPage({ params }: { params: Promise<{ noticeId: string }> }) {
  const { noticeId } = await params;
  if (!uuidPattern.test(noticeId)) notFound();
  const { supabase } = await requireLegalStaff();
  const { data, error } = await supabase.rpc("legal_thread", { target_notice_id: noticeId });
  if (error?.message.includes("not_authorized")) notFound();
  if (error || !data) throw new Error("No se pudo cargar la conversación.");
  const thread = data as Thread;
  const { notice } = thread;
  return <PlatformPage eyebrow={`${thread.unit_label} · ${thread.property}`} title={notice.subject} description={`Con ${notice.recipient_name ? `${notice.recipient_name} · ` : ""}${notice.recipient_email}`}
    back={<Link href={`/juridica/${notice.property_id}?tab=respuestas`} className="text-sm text-muted-foreground hover:text-foreground">← Respuestas del conjunto</Link>}
    actions={<Link href={`/juridica/${notice.property_id}/${notice.unit_id}`} className="text-sm text-primary hover:underline">Ver la cartera del apartamento →</Link>}>
    <ol className="grid gap-3">
      <li className="rounded-2xl border bg-white p-5 text-sm"><p className="text-xs text-muted-foreground">Requerimiento enviado · {formatMoment.format(new Date(notice.created_at))}</p>
        <p className="mt-2 whitespace-pre-line">{notice.message}</p>
        <details className="mt-3"><summary className="cursor-pointer font-medium">{notice.items.length} {notice.items.length === 1 ? "deuda" : "deudas"} · {formatCop(notice.total)}</summary>
          <ul className="mt-2 grid gap-1">{notice.items.map((item, index) => <li key={index} className="flex justify-between gap-3"><span>{item.concept} <span className="text-xs text-muted-foreground">· vence {formatDay(item.due_on)}</span></span><span>{formatCop(item.outstanding)}</span></li>)}</ul></details>
      </li>
      {thread.messages.map((message) => <li key={message.id} className={`rounded-2xl border p-5 text-sm ${message.author === "lawyer" ? "ml-6 bg-primary/5 sm:ml-16" : "mr-6 bg-white sm:mr-16"}`}>
        <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{message.author === "lawyer" ? "Tú" : `Residente${message.from_email ? ` · ${message.from_email}` : ""}`} · {formatMoment.format(new Date(message.created_at))}</span>
          {message.author === "lawyer" && message.delivery_status && <span className="rounded-full bg-secondary px-2 py-0.5">{deliveryLabels[message.delivery_status] ?? message.delivery_status}</span>}</p>
        {message.author === "resident" && message.from_email && message.from_email !== notice.recipient_email && <p className="mt-1 text-xs text-amber-800">Respondió desde un correo distinto al del requerimiento.</p>}
        <p className="mt-2 whitespace-pre-line break-words">{message.body}</p>
      </li>)}
    </ol>
    <section aria-label="Contestar" className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Contestar</h2><p className="mt-1 mb-4 text-sm text-muted-foreground">Le llega al residente por correo con tu firma; si vuelve a responder, aparece aquí.</p><LegalReplyForm noticeId={notice.id} /></section>
  </PlatformPage>;
}
