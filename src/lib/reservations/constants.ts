export const reservationStatusLabel = (status: string) => ({
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
  expired: "Vencida",
  completed: "Finalizada",
}[status] ?? status);

export const weekdayLabels = [
  [1, "Lunes"], [2, "Martes"], [3, "Miércoles"], [4, "Jueves"],
  [5, "Viernes"], [6, "Sábado"], [7, "Domingo"],
] as const;

export const weekdayShortLabel = (weekday: number) => weekdayLabels.find(([value]) => value === weekday)?.[1] ?? `Día ${weekday}`;
