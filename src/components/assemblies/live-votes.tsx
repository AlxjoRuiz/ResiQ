"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { castAssemblyVote, closeAssemblyVote, openAssemblyVote, type AssemblyActionState } from "@/app/panel/propiedades/[propertyId]/asambleas/actions";
import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { statusPill } from "@/lib/ui/status-tones";

export type AssemblyVote = { vote_id: string; question: string; vote_status: "open" | "closed"; opened_at: string; closed_at: string | null; yes_count: number | null; no_count: number | null; abstain_count: number | null; ballot_count: number | null; own_choice: "yes" | "no" | "abstain" | null };
const choiceLabels = { yes: "Sí", no: "No", abstain: "Abstención" } as const;
const choiceBars = { yes: "bg-primary", no: "bg-red-400", abstain: "bg-muted-foreground/40" } as const;

function Result({ state }: { state: AssemblyActionState }) { if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>; if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>; return null; }

// Mientras la asamblea está en curso la página se actualiza sola cada pocos segundos (sin
// conexiones externas, compatible con la CSP). Se pausa con la pestaña oculta.
export function LiveRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);
  return null;
}

function OpenVoteForm({ propertyId, assemblyId }: { propertyId: string; assemblyId: string }) {
  const [state, action, pending] = useFormActionState(openAssemblyVote, undefined as AssemblyActionState);
  return <form onSubmit={action} className="grid gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="assemblyId" value={assemblyId} />
    <label className="block text-sm font-medium">Pregunta para votar<textarea name="question" required minLength={4} maxLength={300} placeholder="¿Aprueban el presupuesto 2027?" className="mt-2 min-h-20 w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
    <div className="flex flex-wrap items-center gap-3"><Button disabled={pending}>{pending ? "Abriendo…" : "Abrir votación"}</Button><Result state={state} /></div>
  </form>;
}

function CloseVoteForm({ propertyId, assemblyId, voteId }: { propertyId: string; assemblyId: string; voteId: string }) {
  const [state, action, pending] = useFormActionState(closeAssemblyVote, undefined as AssemblyActionState);
  return <form onSubmit={action} className="flex flex-wrap items-center gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="assemblyId" value={assemblyId} /><input type="hidden" name="voteId" value={voteId} /><Button size="sm" variant="outline" disabled={pending}>{pending ? "Cerrando…" : "Cerrar votación"}</Button><Result state={state} /></form>;
}

function CastVoteForm({ propertyId, assemblyId, voteId }: { propertyId: string; assemblyId: string; voteId: string }) {
  const [state, action, pending] = useFormActionState(castAssemblyVote, undefined as AssemblyActionState);
  return <form onSubmit={action} className="grid gap-2"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="assemblyId" value={assemblyId} /><input type="hidden" name="voteId" value={voteId} />
    <div className="flex flex-wrap gap-2">{(["yes", "no", "abstain"] as const).map((choice) => <Button key={choice} name="choice" value={choice} size="sm" variant={choice === "yes" ? "default" : "outline"} disabled={pending}>{choiceLabels[choice]}</Button>)}</div>
    <p className="text-xs text-muted-foreground">Tu voto no se puede cambiar y nadie ve qué elegiste.</p><Result state={state} />
  </form>;
}

function Totals({ vote }: { vote: AssemblyVote }) {
  const total = vote.ballot_count ?? 0;
  return <div className="grid gap-2">{(["yes", "no", "abstain"] as const).map((choice) => {
    const count = vote[`${choice}_count`] ?? 0, percent = total ? Math.round((count / total) * 100) : 0;
    return <div key={choice} className="grid gap-1"><div className="flex justify-between text-sm"><span>{choiceLabels[choice]}</span><span className="font-medium">{count} · {percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><span className={`block h-full ${choiceBars[choice]} transition-[width] motion-reduce:transition-none`} style={{ width: `${percent}%` }} /></div></div>;
  })}</div>;
}

// Votaciones Sí / No / Abstención de una asamblea en curso. Administración ve el avance; los
// convocados ven los totales al cerrar, nunca quién eligió cada opción.
export function LiveVotes({ propertyId, assemblyId, votes, isAdmin, inProgress, canVote, presentCount }: { propertyId: string; assemblyId: string; votes: AssemblyVote[]; isAdmin: boolean; inProgress: boolean; canVote: boolean; presentCount: number }) {
  const hasOpen = votes.some((vote) => vote.vote_status === "open");
  const ordered = [...votes].reverse();
  return <section className="mt-6 rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="votaciones">
    <h2 id="votaciones" className="text-xl font-semibold">Votaciones</h2>
    <p className="mt-2 text-sm text-muted-foreground">{isAdmin ? "Abre una pregunta Sí / No / Abstención. Votan quienes marcaron asistencia, un voto por convocado. Los totales se muestran a todos al cerrar." : "Solo pueden votar quienes marcaron su asistencia. Los totales se muestran al cerrar cada votación."}</p>
    {isAdmin && inProgress && !hasOpen && <div className="mt-5 border-t pt-5"><OpenVoteForm propertyId={propertyId} assemblyId={assemblyId} /></div>}
    <div className="mt-5 grid gap-4">
      {ordered.map((vote) => <article key={vote.vote_id} className="rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><p className="min-w-0 break-words font-medium">{vote.question}</p><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusPill[vote.vote_status === "open" ? "warning" : "success"]}`}>{vote.vote_status === "open" ? "Abierta" : "Cerrada"}</span></div>
        <div className="mt-4 grid gap-3">
          {isAdmin && vote.vote_status === "open" && <><p className="text-sm text-muted-foreground">Han votado {vote.ballot_count ?? 0} de {presentCount} presentes.</p><Totals vote={vote} /><CloseVoteForm propertyId={propertyId} assemblyId={assemblyId} voteId={vote.vote_id} /></>}
          {!isAdmin && vote.vote_status === "open" && (vote.own_choice ? <p role="status" className="text-sm">Tu voto: <strong>{choiceLabels[vote.own_choice]}</strong>. Los totales se verán al cerrar.</p> : canVote ? <CastVoteForm propertyId={propertyId} assemblyId={assemblyId} voteId={vote.vote_id} /> : <p className="text-sm text-muted-foreground">Marca tu asistencia para poder votar.</p>)}
          {vote.vote_status === "closed" && <>{vote.own_choice && <p className="text-sm">Tu voto: <strong>{choiceLabels[vote.own_choice]}</strong></p>}<Totals vote={vote} /><p className="text-xs text-muted-foreground">{vote.ballot_count ?? 0} votos en total.</p></>}
        </div>
      </article>)}
      {!votes.length && <p className="text-sm text-muted-foreground">{inProgress ? "Aún no hay votaciones." : "Esta asamblea no tuvo votaciones."}</p>}
    </div>
  </section>;
}
