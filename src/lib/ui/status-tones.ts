// Colores de estado comunes a todas las tarjetas (Notificaciones, Visitas, Paquetes, Asambleas,
// Cartera). El tono es el del proyecto (--primary, azul), en versión clara (26/10/2026).
// «danger» es lo urgente o vencido: rojo --urgent (#DC2626) desde el 09/11/2026.
export type StatusTone = "success" | "warning" | "danger" | "neutral";

/** Tarjeta de una lista: fondo de toda la tarjeta, borde y color al pasar el cursor. */
export const statusCard: Record<StatusTone, string> = {
  success: "border-primary/20 bg-primary/8 hover:bg-primary/12",
  warning: "border-amber-300 bg-amber-50 hover:bg-amber-100/70",
  danger: "border-urgent/40 bg-urgent/5 hover:bg-urgent/10",
  neutral: "bg-card hover:bg-muted/50",
};

/** Mismo tono sin efecto al pasar el cursor, para páginas de detalle. */
export const statusPanel: Record<StatusTone, string> = {
  success: "border-primary/20 bg-primary/8",
  warning: "border-amber-300 bg-amber-50",
  danger: "border-urgent/40 bg-urgent/5",
  neutral: "bg-card",
};

/** Etiqueta de estado (pill). */
export const statusPill: Record<StatusTone, string> = {
  success: "bg-primary/12 text-primary",
  warning: "bg-amber-200 text-amber-950",
  danger: "bg-urgent/15 text-urgent",
  neutral: "bg-secondary",
};

// Leído / no leído de las notificaciones (09/11/2026): no leída en verde azulado (--unread-notice) y
// leída en blanco con texto gris (--read-bg, --read-text). Variables en globals.css.
type ReadTone = "unread" | "read";
export const readCard: Record<ReadTone, string> = {
  unread: "border-unread-notice/40 bg-unread-notice-bg hover:bg-unread-notice/10",
  // Al pasar el cursor la tarjeta leída se pone un poco azul (10/11/2026).
  read: "bg-read-bg hover:border-primary/40 hover:bg-primary/8",
};
export const readPanel: Record<ReadTone, string> = {
  unread: "border-unread-notice/40 bg-unread-notice-bg",
  read: "bg-read-bg",
};
export const readPill: Record<ReadTone, string> = {
  unread: "bg-unread-notice text-white",
  read: "bg-secondary text-read-text",
};
