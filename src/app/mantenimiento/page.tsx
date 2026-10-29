import Link from "next/link";
import { ArrowRight, ClipboardList, Clock3, FileWarning, FileSpreadsheet, LogOut, UserRound, UsersRound, Wrench } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";

// Inicio del módulo de mantenimiento (entrega 1, 28/10/2026). Muestra las secciones según el rol; cada
// una se habilita en su entrega (trabajadores, asistencia, tareas, llamados e informe).
export default async function MaintenanceHomePage() {
  const { supabase, userId, staff } = await requireMaintenanceStaff();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  const isAdmin = staff.role === "admin";
  const sections = isAdmin
    ? [
        { title: "Trabajadores", description: "Crea y administra a los trabajadores de mantenimiento.", icon: UsersRound, href: "/mantenimiento/trabajadores" },
        { title: "Asistencia", description: "Llegadas y salidas de cada trabajador, con su foto.", icon: Clock3, href: "/mantenimiento/asistencia" },
        { title: "Tareas", description: "Asigna tareas y revisa las entregadas con sus fotos.", icon: ClipboardList },
        { title: "Llamados de atención", description: "Registra y consulta los llamados de atención.", icon: FileWarning },
        { title: "Informe mensual", description: "Descarga el informe del mes en Excel y PDF.", icon: FileSpreadsheet },
      ]
    : [
        { title: "Mi asistencia", description: "Marca tu llegada y tu salida con una foto.", icon: Clock3, href: "/mantenimiento/asistencia" },
        { title: "Mis tareas", description: "Consulta tus tareas y entrégalas con fotos.", icon: ClipboardList },
        { title: "Mis llamados de atención", description: "Consulta tus llamados de atención.", icon: FileWarning },
      ];
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-7 sm:px-10">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
      <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white"><Wrench size={20} aria-hidden="true" /></span><div><p className="font-semibold">Mantenimiento ResiQ</p><p className="text-xs text-muted-foreground">{isAdmin ? "Administrador de mantenimiento" : "Trabajador de mantenimiento"}</p></div></div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link href="/perfil"><UserRound size={15} />Perfil</Link></Button><form action={signOut}><Button variant="ghost" size="sm"><LogOut size={15} />Salir</Button></form></div>
    </header>
    <section className="py-7"><p className="text-sm text-muted-foreground">Hola,</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{profile?.display_name ?? "Equipo de mantenimiento"}</h1></section>
    <section aria-label="Secciones" className="grid gap-3 sm:grid-cols-2">
      {sections.map((section) => { const { title, description, icon: Icon } = section; const href = "href" in section ? section.href : undefined; const content = <>
        <div className="flex items-start justify-between gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary"><Icon size={20} aria-hidden="true" /></span>{href ? <ArrowRight size={18} className="text-muted-foreground" aria-hidden="true" /> : <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">Próximamente</span>}</div>
        <h2 className="mt-4 font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </>; return href ? <Link key={title} href={href} className="rounded-2xl border bg-white p-5 transition-colors hover:border-primary/40 hover:bg-secondary/40">{content}</Link> : <article key={title} className="rounded-2xl border bg-white p-5">{content}</article>; })}
    </section>
  </main>;
}
