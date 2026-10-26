// Convocatoria previa a la asamblea: cuenta apartamentos, no personas. Un apartamento asistirá si
// al menos uno de sus convocados respondió «Asistiré»; no asistirá si nadie dijo que sí y alguien
// dijo que no. Se aprueba con más del 50% de apartamentos que asistirán (misma regla de la RPC
// approve_assembly_convocation).
export type ConvocationTally = { yes: number; no: number; pending: number; total: number; percent: number; reached: boolean };

export function tallyConvocation(attendees: { unit_id: string; rsvp: string }[]): ConvocationTally {
  const units = new Map<string, string>();
  for (const row of attendees) {
    const current = units.get(row.unit_id);
    if (row.rsvp === "yes" || current === "yes") units.set(row.unit_id, "yes");
    else if (row.rsvp === "no" || current === "no") units.set(row.unit_id, "no");
    else units.set(row.unit_id, "pending");
  }
  const values = [...units.values()];
  const yes = values.filter((value) => value === "yes").length, no = values.filter((value) => value === "no").length, total = values.length;
  return { yes, no, pending: total - yes - no, total, percent: total ? Math.round((yes / total) * 100) : 0, reached: total > 0 && yes * 2 > total };
}

type StageInput = { status: string; published_at: string | null; requires_attendance_quorum?: boolean | null; attendance_approved_at?: string | null };

/** Estado visible: borrador, convocatoria (pendiente de aprobar), aprobada o el estado guardado. */
export function assemblyStage(item: StageInput) {
  if (item.status === "scheduled" && !item.published_at) return "draft";
  if (item.status === "scheduled" && item.requires_attendance_quorum) return item.attendance_approved_at ? "approved" : "convocation";
  return item.status;
}
