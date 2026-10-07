export const visitKinds = [["personal", "Visita personal"], ["maintenance", "Mantenimiento"]] as const;
export const visitStatuses = [["pending", "Pendiente"], ["rejected", "Rechazada"], ["authorized", "Aceptada"], ["entered", "Ingresó"], ["exited", "Salió"], ["cancelled", "Cancelada"]] as const;
export function visitKindLabel(value: string) { return visitKinds.find(([kind]) => kind === value)?.[1] ?? value; }
export function visitStatusLabel(value: string) { return visitStatuses.find(([status]) => status === value)?.[1] ?? value; }
