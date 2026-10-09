export const packageStatuses = [
  ["received", "Recibido"],
  ["notified", "Notificado"],
  ["delivered", "Entregado"],
] as const;

export function packageStatusLabel(value: string) {
  return packageStatuses.find(([status]) => status === value)?.[1] ?? value;
}

export function receivedItemLabel(kind: string, utilityService: string | null) {
  if (kind !== "utility_bill") return "Paquete";
  const labels: Record<string, string> = { electricity: "luz", gas: "gas", water: "agua" };
  const service = labels[utilityService ?? ""];
  return service ? `Recibo de ${service}` : "Recibo de servicio público";
}
