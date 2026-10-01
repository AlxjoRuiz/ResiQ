export const packageStatuses = [
  ["received", "Recibido"],
  ["notified", "Notificado"],
  ["delivered", "Entregado"],
] as const;

export function packageStatusLabel(value: string) {
  return packageStatuses.find(([status]) => status === value)?.[1] ?? value;
}
