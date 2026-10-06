export const assemblyTypes = [["ordinary", "Ordinaria"], ["extraordinary", "Extraordinaria"]] as const;

export function assemblyTypeLabel(value: string) {
  return assemblyTypes.find(([key]) => key === value)?.[1] ?? value;
}

export const assemblyStatusLabels: Record<string, string> = {
  draft: "Borrador",
  scheduled: "Programada",
  in_progress: "En curso",
  finished: "Finalizada",
  cancelled: "Cancelada",
};

export const rsvpLabels: Record<string, string> = { pending: "Sin responder", yes: "Asistiré", no: "No asistiré" };
export const attendanceLabels: Record<string, string> = { pending: "Sin registrar", present: "Presente", absent: "Ausente" };
export const representationStatusLabels: Record<string, string> = { submitted: "Pendiente", validated: "Validada", rejected: "Rechazada", revoked: "Revocada" };
