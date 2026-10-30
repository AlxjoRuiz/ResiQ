// Etiqueta y color del estado de un conjunto en la plataforma (lista y ficha).
export const propertyStatusLabel = (status: string) => status === "suspended" ? "Suspendido" : status === "active" ? "Activo" : "Archivado";
export const propertyStatusTone = (status: string) => status === "suspended" ? "bg-amber-100 text-amber-900" : status === "active" ? "bg-primary/12 text-primary" : "bg-secondary";
