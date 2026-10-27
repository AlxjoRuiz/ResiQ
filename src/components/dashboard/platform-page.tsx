import Link from "next/link";
import type { ReactNode } from "react";

// Encabezado común de las páginas del panel de plataforma.
export function PlatformPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-7 sm:px-10">
    <Link href="/plataforma" className="text-sm text-muted-foreground hover:text-foreground">← Volver a la plataforma</Link>
    <header className="mt-5 border-b pb-6"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Plataforma</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></header>
    <div className="mt-7 grid gap-6">{children}</div>
  </main>;
}
