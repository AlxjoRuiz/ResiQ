export const noticeCategories = [
  ["pqrs", "PQRS"],
  ["package", "Paquetes"],
  ["visitor", "Visitas"],
  ["reservation", "Reservas"],
  ["receivable", "Cartera"],
  ["payment", "Pagos"],
  ["attention_call", "Llamados"],
  ["assembly", "Asambleas"],
  ["announcement", "Comunicados"],
] as const;

export function noticeCategoryLabel(targetType: string) {
  return noticeCategories.find(([type]) => type === targetType)?.[1] ?? "Aviso";
}
