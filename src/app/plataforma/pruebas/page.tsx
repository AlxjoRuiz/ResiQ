import type { ReactNode } from "react";
import { BriefcaseBusiness, Building2, ChevronDown, UsersRound } from "lucide-react";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { PropertiesView } from "../views/properties-view";
import { TeamsView } from "../views/teams-view";
import { UsersView, usersFiltering, type UsersFilters } from "../views/users-view";

function Section({ title, text, icon, open, children }: { title: string; text: string; icon: ReactNode; open?: boolean; children: ReactNode }) {
  return <details open={open} className="group rounded-2xl border bg-white">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 marker:hidden">
      <span className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">{icon}</span><span className="min-w-0"><span className="block text-lg font-semibold">{title}</span><span className="block text-sm text-muted-foreground">{text}</span></span></span>
      <ChevronDown size={20} aria-hidden="true" className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
    </summary>
    <div className="grid gap-6 border-t p-5">{children}</div>
  </details>;
}

// Pruebas ResiQ (31/10/2026): lo mismo que producción, separado. Una tarjeta por sección (Conjuntos,
// Usuarios y Equipos ResiQ) que se abre al tocarla y muestra la misma vista que la sección de producción,
// solo con lo de prueba. Lo que se crea o invita aquí queda como de prueba.
export default async function PlatformTestsPage({ searchParams }: { searchParams: Promise<UsersFilters> }) {
  const params = await searchParams;
  return <PlatformPage title="Pruebas ResiQ" description="Igual que producción, pero solo con lo de prueba. Toca una sección para abrirla.">
    <Section title="Conjuntos" text="Conjuntos de prueba con su ficha, administración y estado." icon={<Building2 size={20} aria-hidden="true" />}><PropertiesView test /></Section>
    <Section title="Usuarios" text="Administradores, portería y residentes de los conjuntos de prueba." icon={<UsersRound size={20} aria-hidden="true" />} open={usersFiltering(params)}><UsersView test params={params} basePath="/plataforma/pruebas" /></Section>
    <Section title="Equipos ResiQ" text="Mantenimiento y jurídica de prueba, y los correos de prueba." icon={<BriefcaseBusiness size={20} aria-hidden="true" />}><TeamsView test /></Section>
  </PlatformPage>;
}
