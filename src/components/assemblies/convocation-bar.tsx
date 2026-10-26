import type { ConvocationTally } from "@/lib/assemblies/convocation";

// Barra de la convocatoria para administración: verde asistirán, rojo no asistirán, gris sin
// responder; la línea marca el 50% que hay que superar para aprobar.
export function ConvocationBar({ tally }: { tally: ConvocationTally }) {
  const width = (value: number) => `${tally.total ? (value / tally.total) * 100 : 0}%`;
  return <div className="grid gap-2">
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><p><span className="font-semibold">{tally.percent}%</span> de los apartamentos asistirá</p><p className="text-xs text-muted-foreground">Se aprueba con más del 50%</p></div>
    <div role="img" aria-label={`${tally.yes} asistirán, ${tally.no} no asistirán y ${tally.pending} sin responder, de ${tally.total} apartamentos`} className="relative flex h-3 overflow-hidden rounded-full bg-muted">
      <span className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: width(tally.yes) }} />
      <span className="h-full bg-red-400 transition-[width] motion-reduce:transition-none" style={{ width: width(tally.no) }} />
      <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-foreground/60" />
    </div>
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span><span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full bg-primary" />Asistirán: {tally.yes}</span><span><span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full bg-red-400" />No asistirán: {tally.no}</span><span><span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full bg-muted-foreground/40" />Sin responder: {tally.pending}</span><span>Total: {tally.total} apartamentos</span></p>
  </div>;
}
