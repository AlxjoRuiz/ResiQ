export const attentionCallCategories = [
  ["coexistence", "Convivencia"], ["noise", "Ruido"], ["pets", "Mascotas"],
  ["waste", "Residuos"], ["common_areas", "Uso de zonas comunes"], ["security", "Seguridad"],
  ["parking", "Parqueaderos"], ["administrative", "Incumplimiento administrativo"], ["other", "Otro"],
] as const;

export const attentionCallStatuses = [
  ["created", "Creado"], ["notified", "Notificado"], ["in_review", "En revisión"], ["closed", "Cerrado"],
] as const;

export function attentionCategoryLabel(value: string) { return attentionCallCategories.find(([key]) => key === value)?.[1] ?? value; }
export function attentionStatusLabel(value: string) { return attentionCallStatuses.find(([key]) => key === value)?.[1] ?? value; }
