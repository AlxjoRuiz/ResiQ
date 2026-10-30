import type { ReactNode } from "react";

// Encabezado común de las páginas del panel de plataforma. Desde el 30/10/2026 van dentro del marco con
// la barra de secciones, así que ya no llevan el enlace «Volver a la plataforma». back: enlace opcional
// (p. ej. de la ficha de un conjunto a la lista).
export function PlatformPage({ title, description, eyebrow = "Plataforma", back, actions, children }: { title: string; description: string; eyebrow?: string; back?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl">
    {back}
    <header className={`${back ? "mt-4" : ""} flex flex-wrap items-end justify-between gap-4 border-b pb-6`}><div className="min-w-0"><p className="text-xs font-semibold tracking-wider text-primary uppercase">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>{actions}</header>
    <div className="mt-7 grid gap-6">{children}</div>
  </div>;
}
