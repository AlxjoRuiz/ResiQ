import Link from "next/link";
import { Scale, ShieldCheck, UserCog, UserRound, Wrench, type LucideIcon } from "lucide-react";

// Etiqueta del perfil (15/11/2026, pedido de Alejandro): recuadro claro con el ícono en un cuadro de borde azul y el
// nombre del perfil en el mismo azul. Solo informa: no se puede pulsar. Igual en Inicio y en todas las secciones.
const icons: Record<string, LucideIcon> = { "Administración": UserCog, "Residente": UserRound, "Portería": ShieldCheck, "Abogada": Scale, "Superadmin": ShieldCheck };

export function ProfileBadge({ label, icon }: { label: string; icon?: LucideIcon }) {
  const Icon = icon ?? icons[label] ?? (label.toLowerCase().includes("mantenimiento") ? Wrench : UserRound);
  return <span className="inline-flex shrink-0 items-center gap-2.5 rounded-2xl border border-primary/15 bg-primary/5 py-1.5 pr-4 pl-1.5 shadow-sm" aria-label={`Perfil: ${label}`}>
    <span className="flex size-8 items-center justify-center rounded-xl border-2 border-primary bg-white text-primary"><Icon size={17} strokeWidth={2.2} aria-hidden="true" /></span>
    <span className="text-sm font-semibold text-primary">{label}</span>
  </span>;
}

/** Enlace pequeño a «Tu perfil», al lado de la etiqueta (la etiqueta ya no lleva a ninguna parte). */
export function MyProfileLink() {
  return <Link href="/perfil" className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline">Mi perfil</Link>;
}

/** Etiqueta + «Mi perfil» juntos, para la barra superior. */
export function ProfileArea({ label, children }: { label: string; children?: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-3"><ProfileBadge label={label} />{children}<MyProfileLink /></div>;
}
