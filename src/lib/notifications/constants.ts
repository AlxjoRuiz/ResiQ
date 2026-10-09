const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const noticeCategories = [
  ["pqrs", "PQRS"],
  ["package", "Paquetes y recibos"],
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

export function noticeTargetPath(propertyId: string, targetType: string, targetId: string | null) {
  const base = `/panel/propiedades/${propertyId}`;
  const detail = targetId && uuidPattern.test(targetId) ? targetId : null;
  switch (targetType) {
    case "pqrs": return detail ? `${base}/pqrs/${detail}` : `${base}/pqrs`;
    case "package": return detail ? `${base}/paquetes/${detail}` : `${base}/paquetes`;
    case "visitor": return detail ? `${base}/visitas/${detail}` : `${base}/visitas`;
    case "reservation": return `${base}/reservas`;
    case "receivable": case "payment": return `${base}/cartera`;
    case "attention_call": return detail ? `${base}/llamados/${detail}` : `${base}/llamados`;
    case "assembly": return detail ? `${base}/asambleas/${detail}` : `${base}/asambleas`;
    case "announcement": return detail ? `${base}/comunicados/${detail}` : `${base}/comunicados`;
    default: return null;
  }
}
