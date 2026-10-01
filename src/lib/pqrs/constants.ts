export const pqrsCategories = [
  ["accounting", "Contable"], ["administration", "Administración"], ["security", "Vigilancia"],
  ["complaint", "Queja"], ["operations", "Operativo"], ["cleaning", "Aseo"],
  ["maintenance", "Mantenimiento"], ["suggestion", "Sugerencia"],
] as const;
export const pqrsStatuses = [
  ["pending", "Pendiente"], ["in_review", "En revisión"], ["in_progress", "En proceso"],
  ["answered", "Respondida"], ["closed", "Cerrada"],
] as const;
export function categoryLabel(value:string){return pqrsCategories.find(([key])=>key===value)?.[1]??value;}
export function statusLabel(value:string){return pqrsStatuses.find(([key])=>key===value)?.[1]??value;}
