// Colores de estado comunes a todas las tarjetas (Notificaciones, Visitas, Paquetes, Asambleas,
// Cartera). El verde es el del proyecto (--primary), el mismo de Asambleas respondidas.
export type StatusTone = "success" | "warning" | "danger" | "neutral";

/** Tarjeta de una lista: fondo de toda la tarjeta, borde y color al pasar el cursor. */
export const statusCard: Record<StatusTone, string> = {
  success: "border-primary/30 bg-primary/15 hover:bg-primary/20",
  warning: "border-amber-300 bg-amber-50 hover:bg-amber-100/70",
  danger: "border-red-300 bg-red-50 hover:bg-red-100/70",
  neutral: "bg-card hover:bg-muted/50",
};

/** Mismo tono sin efecto al pasar el cursor, para páginas de detalle. */
export const statusPanel: Record<StatusTone, string> = {
  success: "border-primary/30 bg-primary/15",
  warning: "border-amber-300 bg-amber-50",
  danger: "border-red-300 bg-red-50",
  neutral: "bg-card",
};

/** Etiqueta de estado (pill). */
export const statusPill: Record<StatusTone, string> = {
  success: "bg-primary/20 text-primary",
  warning: "bg-amber-200 text-amber-950",
  danger: "bg-red-200 text-red-950",
  neutral: "bg-secondary",
};
