// Textos del expediente prejurídico (03/11/2026), compartidos por las páginas y los formularios.
export const caseStatusLabels: Record<string, string> = {
  open: "Abierto", contacted: "Contactado", commitment: "Compromiso de pago", broken: "Compromiso incumplido", legal: "Remitido a cobro jurídico", closed: "Cerrado",
};
export const caseStatusTones: Record<string, string> = {
  open: "bg-secondary", contacted: "bg-primary/12 text-primary", commitment: "bg-amber-100 text-amber-900", broken: "bg-red-100 text-red-800",
  legal: "bg-red-100 text-red-800", closed: "bg-secondary text-muted-foreground",
};
export const caseActionLabels: Record<string, string> = {
  call: "Llamada", email: "Correo", whatsapp: "WhatsApp", visit: "Visita", note: "Nota", notice: "Requerimiento de pago", reply: "Respuesta del residente", status: "Expediente",
};
export const commitmentLabels: Record<string, string> = { pending: "Pendiente", met: "Cumplido", broken: "Incumplido" };
