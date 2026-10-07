export const pqrsRequestTypes = [["request", "Petición"], ["complaint", "Queja"], ["claim", "Reclamo"], ["suggestion", "Sugerencia"]] as const;
export function requestTypeLabel(value:string|null){return pqrsRequestTypes.find(([key])=>key===value)?.[1]??"PQRS anterior";}
export const pqrsCategories = [
  ["accounting", "Contable"], ["administration", "Administración"], ["security", "Vigilancia"],
  ["operations", "Operativo"], ["cleaning", "Aseo"],
  ["maintenance", "Mantenimiento"],
] as const;
export const pqrsStatuses = [
  ["pending", "Pendiente"], ["in_review", "En revisión"], ["in_progress", "En proceso"],
  ["answered", "Respondida"], ["closed", "Cerrada"],
] as const;
export function categoryLabel(value:string){if(value==="complaint"||value==="suggestion")return "Tema sin especificar";return pqrsCategories.find(([key])=>key===value)?.[1]??value;}
export function statusLabel(value:string){return pqrsStatuses.find(([key])=>key===value)?.[1]??value;}
